declare module "react-katex" {
  import type { FC } from "react";

  export const BlockMath: FC<{ math: string; className?: string }>;
  export const InlineMath: FC<{ math: string; className?: string }>;
}
