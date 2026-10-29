import { describe, expect, it } from 'vitest';
import {
  getOrderSpeed,
  getOrderSpeedLabel,
  matchesOrderSpeedFilter,
} from '../../src/lib/orderSpeed';

describe('orderSpeed', () => {
  it('distingue Normal, Express et mixte avec le repli historique', () => {
    expect(getOrderSpeed({ lines: [{ isExpress: false }] })).toBe('normal');
    expect(getOrderSpeed({ lines: [{ isExpress: true }] })).toBe('express');
    expect(getOrderSpeed({ lines: [{ isExpress: false }, { isExpress: true }] })).toBe('mixed');
    expect(getOrderSpeed({ isUrgent: true, lines: [{}] })).toBe('express');
    expect(getOrderSpeed({ isUrgent: false, lines: [{}] })).toBe('normal');
    expect(getOrderSpeed({ isUrgent: true, lines: [] })).toBe('express');
  });

  it('retrouve les commandes mixtes dans Express parce qu’elles sont prioritaires', () => {
    const normal = { lines: [{ isExpress: false }] };
    const express = { lines: [{ isExpress: true }] };
    const mixed = { lines: [{ isExpress: false }, { isExpress: true }] };

    expect(matchesOrderSpeedFilter(normal, 'normal')).toBe(true);
    expect(matchesOrderSpeedFilter(normal, 'express')).toBe(false);
    expect(matchesOrderSpeedFilter(express, 'express')).toBe(true);
    expect(matchesOrderSpeedFilter(mixed, 'express')).toBe(true);
    expect(matchesOrderSpeedFilter(mixed, 'mixed')).toBe(true);
    expect(matchesOrderSpeedFilter(mixed, 'normal')).toBe(false);
    expect(matchesOrderSpeedFilter(mixed, 'all')).toBe(true);
    expect(getOrderSpeedLabel(mixed)).toBe('Express · mixte');
  });
});
