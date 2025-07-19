// src/app.d.ts
declare global {
    namespace App {
        interface Locals {
            user: { username: string; name: string; email: string; role: string } | null;
        }
    }
}
export {};
