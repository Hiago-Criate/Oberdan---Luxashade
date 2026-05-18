import { motion } from 'motion/react';
import { type ReactNode } from 'react';

interface Props {
  label: string;
  hint?: string;
  children: ReactNode;
  active?: boolean;
}

// Casca padrão de cada step: label uppercase fino + container animando entrada.
export function StepShell({ label, hint, children, active = true }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: active ? 1 : 0.5, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-2"
    >
      <label className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-zinc-400">{hint}</p>}
    </motion.div>
  );
}
