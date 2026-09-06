import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Mario - First Person Adventure',icons:{icon:'/favicon.svg'},description:'Step into the red cap. Explore a 3D Mushroom Kingdom, collect coins, stomp Goombas, and race to the flag in a first-person browser platformer.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
