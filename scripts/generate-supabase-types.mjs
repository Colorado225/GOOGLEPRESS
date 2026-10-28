import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const migrationsDir = join(repoRoot, 'supabase', 'migrations');
const outputPath = process.argv[2]
  ? join(repoRoot, process.argv[2])
  : join(repoRoot, 'src', 'lib', 'database.types.ts');

const q = (value) => JSON.stringify(value);

const db = new PGlite();
await db.waitReady;

try {
  // Même émulation minimale que le harnais Phase 0 : permet d'appliquer les
  // migrations qui référencent auth.users/auth.uid() hors d'un projet hébergé.
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create role supabase_auth_admin nologin;
    create schema auth;
    create table auth.users (
      id uuid primary key,
      email text,
      phone text,
      raw_user_meta_data jsonb not null default '{}'::jsonb
    );
    create or replace function auth.uid()
    returns uuid
    language sql
    stable
    as $$ select nullif(current_setting('test.user_id', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `);

  const migrationFiles = (await readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();
  for (const file of migrationFiles) {
    await db.exec(await readFile(join(migrationsDir, file), 'utf8'));
  }

  const enumRows = (
    await db.query(`
      select t.typname as name, e.enumlabel as value
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
      join pg_enum e on e.enumtypid = t.oid
      where n.nspname = 'public'
      order by t.typname, e.enumsortorder
    `)
  ).rows;

  const enums = new Map();
  for (const row of enumRows) {
    if (!enums.has(row.name)) enums.set(row.name, []);
    enums.get(row.name).push(row.value);
  }

  const mapUdt = (udtName) => {
    if (!udtName) return 'unknown';
    if (enums.has(udtName)) return `Database["public"]["Enums"][${q(udtName)}]`;
    switch (udtName) {
      case 'int2':
      case 'int4':
      case 'int8':
      case 'float4':
      case 'float8':
      case 'numeric':
      case 'money':
        return 'number';
      case 'bool':
        return 'boolean';
      case 'json':
      case 'jsonb':
        return 'Json';
      default:
        return 'string';
    }
  };

  const mapColumnType = (column) => {
    if (column.data_type === 'ARRAY') {
      return `${mapUdt(String(column.udt_name || '').replace(/^_/, ''))}[]`;
    }
    if (column.data_type === 'USER-DEFINED') return mapUdt(column.udt_name);

    switch (column.data_type) {
      case 'smallint':
      case 'integer':
      case 'bigint':
      case 'decimal':
      case 'numeric':
      case 'real':
      case 'double precision':
      case 'money':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'json':
      case 'jsonb':
        return 'Json';
      default:
        return 'string';
    }
  };

  const tables = (
    await db.query(`
      select table_name
      from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
      order by table_name
    `)
  ).rows.map((row) => row.table_name);

  const columns = (
    await db.query(`
      select table_name, column_name, data_type, udt_name, is_nullable,
             column_default, is_identity, is_generated
      from information_schema.columns
      where table_schema = 'public'
      order by table_name, ordinal_position
    `)
  ).rows;

  const columnsByTable = new Map(tables.map((table) => [table, []]));
  for (const column of columns) {
    if (!columnsByTable.has(column.table_name)) columnsByTable.set(column.table_name, []);
    columnsByTable.get(column.table_name).push(column);
  }

  const relationships = (
    await db.query(`
      select
        rel.relname as table_name,
        c.conname as foreign_key_name,
        array_agg(a.attname order by k.ord) as columns,
        frel.relname as referenced_relation,
        array_agg(fa.attname order by k.ord) as referenced_columns,
        exists (
          select 1
          from pg_constraint u
          where u.conrelid = c.conrelid
            and u.contype in ('p', 'u')
            and u.conkey = c.conkey
        ) as is_one_to_one
      from pg_constraint c
      join pg_namespace n on n.oid = c.connamespace
      join pg_class rel on rel.oid = c.conrelid
      join pg_class frel on frel.oid = c.confrelid
      join pg_namespace fn on fn.oid = frel.relnamespace
      join lateral unnest(c.conkey, c.confkey) with ordinality as k(attnum, fattnum, ord) on true
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
      join pg_attribute fa on fa.attrelid = c.confrelid and fa.attnum = k.fattnum
      where c.contype = 'f' and n.nspname = 'public' and fn.nspname = 'public'
      group by rel.relname, c.conname, frel.relname, c.conrelid, c.conkey
      order by rel.relname, c.conname
    `)
  ).rows;

  const relationshipsByTable = new Map(tables.map((table) => [table, []]));
  for (const rel of relationships) {
    if (!relationshipsByTable.has(rel.table_name)) relationshipsByTable.set(rel.table_name, []);
    relationshipsByTable.get(rel.table_name).push(rel);
  }

  const renderColumns = (tableColumns, mode) =>
    tableColumns
      .map((column) => {
        const nullable = column.is_nullable === 'YES';
        const baseType = mapColumnType(column);
        const rowType = nullable ? `${baseType} | null` : baseType;
        const optional =
          mode === 'Update' ||
          nullable ||
          column.column_default !== null ||
          column.is_identity === 'YES' ||
          column.is_generated === 'ALWAYS';
        return `          ${q(column.column_name)}${mode !== 'Row' && optional ? '?' : ''}: ${rowType};`;
      })
      .join('\n');

  const renderRelationships = (tableRelationships) => {
    if (!tableRelationships.length) return '        Relationships: [];';
    const items = tableRelationships
      .map(
        (rel) => `          {
            foreignKeyName: ${q(rel.foreign_key_name)};
            columns: ${q(rel.columns)};
            isOneToOne: ${rel.is_one_to_one ? 'true' : 'false'};
            referencedRelation: ${q(rel.referenced_relation)};
            referencedColumns: ${q(rel.referenced_columns)};
          }`
      )
      .join(',\n');
    return `        Relationships: [\n${items}\n        ];`;
  };

  const tableBlocks = tables
    .map((table) => {
      const tableColumns = columnsByTable.get(table) ?? [];
      return `      ${q(table)}: {
        Row: {
${renderColumns(tableColumns, 'Row')}
        };
        Insert: {
${renderColumns(tableColumns, 'Insert')}
        };
        Update: {
${renderColumns(tableColumns, 'Update')}
        };
${renderRelationships(relationshipsByTable.get(table) ?? [])}
      };`;
    })
    .join('\n');

  const enumBlocks = [...enums.entries()]
    .map(([name, values]) => `      ${q(name)}: ${values.map(q).join(' | ')};`)
    .join('\n');

  const content = `// Généré par scripts/generate-supabase-types.mjs.
// Source : application locale PGlite des migrations supabase/migrations/*.sql.
// Ne pas modifier manuellement ; régénérer après toute nouvelle migration.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
${tableBlocks}
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
${enumBlocks || '      [_ in never]: never;'}
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
`;

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, content, 'utf8');
  console.log(
    `Types Supabase générés : ${tables.length} tables, ${columns.length} colonnes, ${enums.size} enums → ${outputPath}`
  );
} finally {
  await db.close();
}
