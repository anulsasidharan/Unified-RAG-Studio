import { DesignerShell } from '@/components/designer/designer-shell';

export default function DesignerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <DesignerShell>{children}</DesignerShell>;
}
