# Yangkar SvelteKit Project

## Project Setup

This project uses a monorepo structure managed by pnpm workspaces:

- `/apps/frontend`: SvelteKit frontend application
- `/apps/backend`: Express.js backend API with Prisma

## Prerequisites

- Node.js 18.x or higher
- pnpm 10.13.1 or higher

## Installation

Install dependencies for all workspaces:

```bash
pnpm install
```

## Development

Run both frontend and backend in development mode:

```bash
pnpm dev
```

Run only frontend:

```bash
pnpm frontend dev
```

Run only backend:

```bash
pnpm backend dev
```

## Database Management

Open Prisma Studio to manage the database:

```bash
pnpm backend prisma:studio
```

Run database migrations:

```bash
pnpm backend prisma:migrate:dev --name your_migration_name
```

Generate Prisma client:

```bash
pnpm backend prisma:generate
```

## Building for Production

Build all packages:

```bash
pnpm build
```

## VS Code Tasks

This project includes several VS Code tasks for common operations:

- **Start Backend**: Starts the backend server
- **Start Frontend**: Starts the SvelteKit development server
- **Start Full Stack**: Starts both backend and frontend
- **Prisma Studio**: Opens Prisma Studio for database management
- **Prisma Migrate Dev**: Runs database migrations with a prompted name

## Package Management

This project uses pnpm exclusively. Please do not use npm or yarn as this may cause dependency resolution issues.
