import "./globals.css"; import type { Metadata } from "next";
export const metadata:Metadata={title:"Hijaz Tamil News | Automation",description:"Editorial automation dashboard for @hijaz_ah"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ta"><body>{children}</body></html>}