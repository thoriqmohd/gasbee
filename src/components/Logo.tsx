import gasbeeMark from "@/assets/gasbee-mark.png";
import gasbeeLogo from "@/assets/gasbee-logo.png";

export function Logo({ size = 40, className = "" }: { size?: number; className?: string }) {
  return <img src={gasbeeMark} alt="Gasbee" width={size} height={size} className={className} style={{ width: size, height: size }} />;
}

export function LogoFull({ height = 32, className = "" }: { height?: number; className?: string }) {
  return <img src={gasbeeLogo} alt="Gasbee — Be Ready Bee Delivers" className={className} style={{ height }} />;
}
