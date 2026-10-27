import React, {
  createContext,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import confetti from 'canvas-confetti';
import type {
  CreateTypes,
  GlobalOptions,
  Options as ConfettiOptions,
} from 'canvas-confetti';
import { cn } from '../../lib/utils';

export interface ConfettiRef {
  fire: (options?: ConfettiOptions) => void;
}

export interface ConfettiProps
  extends React.ComponentPropsWithoutRef<'canvas'> {
  options?: ConfettiOptions;
  globalOptions?: GlobalOptions;
  manualstart?: boolean;
  children?: React.ReactNode;
}

export type ConfettiButtonProps = {
  options?: ConfettiOptions;
  children?: React.ReactNode;
} & React.ComponentPropsWithoutRef<'button'>;

interface ConfettiContextType {
  fire: (options?: ConfettiOptions) => void;
}

const ConfettiContext = createContext<ConfettiContextType>({} as ConfettiContextType);

export const Confetti = forwardRef<ConfettiRef, ConfettiProps>(
  (
    {
      options,
      globalOptions = { resize: true, useWorker: true },
      manualstart = false,
      children,
      className,
      ...props
    },
    ref
  ) => {
    const instanceRef = useRef<CreateTypes | null>(null);

    const canvasRef = useCallback(
      (node: HTMLCanvasElement | null) => {
        if (node !== null) {
          instanceRef.current = confetti.create(node, {
            ...globalOptions,
            resize: true,
          });
        } else {
          if (instanceRef.current) {
            instanceRef.current.reset();
            instanceRef.current = null;
          }
        }
      },
      [globalOptions]
    );

    const fire = useCallback(
      (opts = {}) => {
        if (instanceRef.current) {
          instanceRef.current({ ...options, ...opts });
        } else {
          confetti({ ...options, ...opts });
        }
      },
      [options]
    );

    const api = React.useMemo(
      () => ({
        fire,
      }),
      [fire]
    );

    useImperativeHandle(ref, () => api, [api]);

    useEffect(() => {
      if (!manualstart) {
        fire();
      }
    }, [manualstart, fire]);

    return (
      <ConfettiContext.Provider value={api}>
        <canvas ref={canvasRef} className={cn('pointer-events-none', className)} {...props} />
        {children}
      </ConfettiContext.Provider>
    );
  }
);

Confetti.displayName = 'Confetti';

export const ConfettiButton = forwardRef<HTMLButtonElement, ConfettiButtonProps>(
  ({ options, children, onClick, className, ...props }, ref) => {
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = (rect.left + rect.width / 2) / window.innerWidth;
      const y = (rect.top + rect.height / 2) / window.innerHeight;

      confetti({
        origin: { x, y },
        particleCount: 80,
        spread: 70,
        colors: ['#2563EB', '#0D9488', '#F59E0B', '#10B981', '#6366F1', '#EC4899'],
        ...options,
      });

      if (onClick) {
        onClick(event);
      }
    };

    return (
      <button
        ref={ref}
        onClick={handleClick}
        className={cn(className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

ConfettiButton.displayName = 'ConfettiButton';

/**
 * Global celebration function to trigger joyous confetti bursts when an order is submitted.
 * Fires a dual-side cannon followed by center star burst.
 */
export function fireOrderCelebration(serviceCategory?: 'pressing' | 'blanchisserie') {
  const isBlanchisserie = serviceCategory === 'blanchisserie';
  const themeColors = isBlanchisserie
    ? ['#0D9488', '#14B8A6', '#2DD4BF', '#F59E0B', '#3B82F6', '#10B981']
    : ['#2563EB', '#3B82F6', '#60A5FA', '#F59E0B', '#10B981', '#8B5CF6'];

  // Left cannon
  confetti({
    particleCount: 65,
    angle: 60,
    spread: 60,
    origin: { x: 0.1, y: 0.65 },
    colors: themeColors,
    zIndex: 99999,
  });

  // Right cannon
  confetti({
    particleCount: 65,
    angle: 120,
    spread: 60,
    origin: { x: 0.9, y: 0.65 },
    colors: themeColors,
    zIndex: 99999,
  });

  // Center star burst 250ms later
  setTimeout(() => {
    confetti({
      particleCount: 80,
      spread: 100,
      origin: { y: 0.6 },
      colors: ['#F59E0B', '#10B981', '#2563EB', '#0D9488', '#FFFFFF'],
      shapes: ['star', 'circle'],
      zIndex: 99999,
    });
  }, 250);
}

export function ConfettiButtonDemo() {
  return (
    <div className="relative">
      <ConfettiButton>Confetti 🎉</ConfettiButton>
    </div>
  );
}

export { confetti };
export default Confetti;
