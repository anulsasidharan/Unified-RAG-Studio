import { AutopilotShell } from '@/components/autopilot/autopilot-shell';

export default function AutopilotLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AutopilotShell>{children}</AutopilotShell>;
}
