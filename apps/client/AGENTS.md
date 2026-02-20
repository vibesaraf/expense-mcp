# AGENTS.md

## Stack

- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS 4 with `tailwind-merge`, `class-variance-authority`, `tw-animate-css`
- shadcn/ui components built on Radix UI and Base UI
- AI SDK (`ai`, `@ai-sdk/*`) for model integrations
- React Hook Form + Zod for forms and validation
- Recharts, date-fns, lucide-react, sonner, embla-carousel, cmdk

## Package Manager

Bun is the package manager for this app. Use `bun` instead of `npm` or `yarn`.

## Adding Packages

From `apps/client`:

```bash
bun add <package>
bun add -d <package>
```

## Component Locations

- shadcn/ui components: `src/components/ui`
- Chat UI: `src/components/chat` (`chat.tsx`, `message-input.tsx`, `message-list.tsx`)
- Model selection: `src/components/model-selector.tsx`
- Routes and layouts: `src/app`
- Shared hooks/utilities: `src/hooks`, `src/lib`
