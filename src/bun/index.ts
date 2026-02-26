import { BrowserWindow } from "electrobun/bun";

// Determine the frontend URL
const isDev = process.env.NODE_ENV !== "production";
const frontendUrl = isDev 
  ? "http://localhost:5173"  // Vite default dev port
  : "http://localhost:4173";  // Vite preview port

console.log(`[Electrobun] Opening RSS Reader at ${frontendUrl}`);

// Create and open the window
new BrowserWindow({
  title: "RSS Reader",
  url: frontendUrl,
});

console.log(`[Electrobun] Window opened`);
