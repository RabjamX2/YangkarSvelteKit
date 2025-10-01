# Yangkar SvelteKit CSS Guide

This document outlines the CSS architecture and design system for Yangkar SvelteKit project. It provides guidelines on how to use CSS variables, components, and utility classes consistently across the application.

## Quick Start: Changing Site Fonts

The site uses locally hosted fonts from the `static/fonts` directory:

- **Primary Font**: Inter (Variable Font)
- **First Fallback**: Roboto (Variable Font)
- **Final Fallback**: Standard system sans-serif fonts

To change fonts across the entire site, simply modify these variables in `apps/frontend/static/app.css`:

1. **Change the primary font across the site**:

    ```css
    --font-sans: "Inter", "Roboto", Arial, sans-serif;
    ```

2. **Use different fonts for different elements**:

    ```css
    --font-heading: var(--font-serif); /* Change all headings */
    --font-nav: "Work Sans", "Roboto", Arial, sans-serif; /* Change navigation font */
    --font-buttons: "Roboto", Arial, sans-serif; /* Change button font */
    ```

3. **Add a new font**:
    - Place font files in `static/fonts/[Font-Name]/`
    - Add @font-face declarations in `static/fonts.css`
    - Use the font in your variables
    ```css
    --font-accent: "Work Sans", "Roboto", Arial, sans-serif;
    ```

## Table of Contents

1. [Design System](#design-system)
2. [CSS Variables](#css-variables)
3. [File Structure](#file-structure)
4. [Components](#components)
5. [Utility Classes](#utility-classes)
6. [Dark Mode](#dark-mode)
7. [Font Usage Examples](#font-usage-examples)

## Design System

The design system is built on a set of design tokens implemented as CSS variables. These tokens ensure consistency across the application. The main categories include:

- Typography
- Colors
- Spacing
- Layout
- Status colors

## CSS Variables

### Typography

#### Font Families

To change fonts across the application, edit the font family variables in `app.css`:

```css
/* Base font definitions - Change these to use different font stacks */
--font-sans: "Inter", Arial, sans-serif;
--font-serif: Georgia, "Times New Roman", serif;
--font-mono: "Roboto Mono", Consolas, monospace;
```

#### Font Usage Variables

The site uses functional font variables that make it easy to update fonts for specific purposes:

```css
/* Functional Font Variables - Change these to update fonts across the site */
--font-primary: var(--font-sans); /* Main text font */
--font-heading: var(--font-sans); /* Headings font */
--font-nav: var(--font-sans); /* Navigation font */
--font-buttons: var(--font-sans); /* Button font */
--font-code: var(--font-mono); /* Code blocks font */
--font-accent: var(--font-serif); /* Accent text font */
```

For example, to change all headings to use a serif font:

```css
--font-heading: var(--font-serif);
```

Or to use a completely different font for navigation:

```css
--font-sans: "Montserrat", Arial, sans-serif;
--font-nav: var(--font-sans);
```

#### Font Sizes

```css
--font-size-xs: 0.75rem; /* 12px */
--font-size-small: 0.875rem; /* 14px */
--font-size-medium: 1rem; /* 16px - base font size */
--font-size-large: 1.25rem; /* 20px */
--font-size-xl: 1.5rem; /* 24px */
--font-size-2xl: 1.75rem; /* 28px */
```

#### Font Weights

```css
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-bold: 700;
```

Line heights:

```css
--line-height-tight: 1.25;
--line-height-normal: 1.5;
```

Letter spacing:

```css
--letter-spacing: 0.8px;
```

### Colors

Core color palette:

```css
--color-primary: #2563eb; /* Main brand color */
--color-primary-hover: #1e40af;
--color-primary-light: #60a5fa;
--color-danger: #e53e3e; /* Error/warning color */
--color-danger-hover: #b91c1c;
--color-success: #155724; /* Success color */
--color-warning: #856404; /* Warning color */
--color-text: #374151; /* Main text color */
--color-text-light: #6b7280; /* Secondary text color */
```

Interface colors:

```css
--color-bg: #fff; /* Background color */
--color-nav-bg: #fff; /* Navigation background */
--color-border: #000000; /* Border color */
--color-shadow: 0 2px 8px rgba(0, 0, 0, 0.03); /* Shadow */
--color-link: var(--color-text); /* Link color */
--color-link-hover: var(--color-primary); /* Link hover color */
```

### Spacing

The spacing system provides consistent spacing throughout the application:

```css
--space-1: 0.25rem; /* 4px */
--space-2: 0.5rem; /* 8px */
--space-3: 0.75rem; /* 12px */
--space-4: 1rem; /* 16px */
--space-6: 1.5rem; /* 24px */
--space-8: 2rem; /* 32px */
```

### Layout

Layout variables control the container width and border radius:

```css
--container-max-width: 1920px;
--border-radius-sm: 4px;
--border-radius-md: 6px;
--border-radius-lg: 8px;
--border-radius-full: 50%;
```

### Status Colors

For status indicators:

```css
--order-cancelled-bg: #ffeaea;
--order-cancelled-color: var(--color-danger-hover);
--status-pending-bg: #fff3cd;
--status-pending-color: var(--color-warning);
--status-received-bg: #d4edda;
--status-received-color: var(--color-success);
```

## File Structure

- `app.css`: Main CSS file with variables and global styles
- Route-specific CSS files (e.g., `products.css`) for styles specific to certain pages
- Component-specific styles in component files

## Components

Common components with consistent styles:

### Buttons

Standard button:

```css
.btn {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--border-radius-md);
    font-weight: var(--font-weight-medium);
    /* other properties */
}
```

Types:

- `.btn-primary`: Primary action button
- `.btn-danger`: Delete or warning action

### Cards

```css
.product-card {
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-lg);
    overflow: hidden;
    box-shadow: var(--color-shadow);
}
```

## Utility Classes

Common utility classes:

```css
.container {
    max-width: var(--container-max-width);
    margin-right: auto;
    margin-left: auto;
    padding-right: var(--space-4);
    padding-left: var(--space-4);
}
```

## Dark Mode

Dark mode is activated by adding the `.dark` class to the `html` element. The CSS variables are then updated with dark mode values.

To toggle dark mode:

```javascript
document.documentElement.classList.toggle("dark");
```

## Font Usage Examples

### Changing Fonts Across the Site

Below are examples of how to modify fonts across your website by changing only the font variables:

#### Example 1: Modern Sans-serif Website

```css
:root {
    --font-sans: "Montserrat", Arial, sans-serif;
    --font-serif: "Merriweather", Georgia, serif;
    --font-mono: "Fira Code", monospace;

    --font-primary: var(--font-sans);
    --font-heading: var(--font-sans);
    --font-nav: var(--font-sans);
    --font-buttons: var(--font-sans);
}
```

#### Example 2: Newspaper/Blog Style

```css
:root {
    --font-sans: "Source Sans Pro", Arial, sans-serif;
    --font-serif: "Playfair Display", Georgia, serif;

    --font-primary: var(--font-sans);
    --font-heading: var(--font-serif);
    --font-accent: var(--font-serif);
}
```

#### Example 3: Technical Documentation

```css
:root {
    --font-sans: "Inter", Arial, sans-serif;
    --font-mono: "IBM Plex Mono", Consolas, monospace;

    --font-primary: var(--font-sans);
    --font-code: var(--font-mono);
    --font-buttons: var(--font-mono);
}
```

### Font Implementation in Components

When creating new components, use the font variables instead of hardcoding font families:

```css
/* ❌ Don't do this */
.custom-component {
    font-family: Arial, sans-serif;
}

/* ✅ Do this instead */
.custom-component {
    font-family: var(--font-primary);
}
```

For specialized components, choose the appropriate font variable:

```css
.code-snippet {
    font-family: var(--font-code);
}

.navigation-item {
    font-family: var(--font-nav);
}

.headline {
    font-family: var(--font-heading);
}
```

### Handling Inline Styles in Svelte Components

When working with inline styles in Svelte components, always prefer using CSS variables for consistency:

```svelte
<!-- ❌ Don't do this -->
<button style="font-weight: 600; font-family: Arial;">Click me</button>

<!-- ✅ Do this instead -->
<button style="font-weight: var(--font-weight-medium); font-family: var(--font-buttons);">
  Click me
</button>
```

Whenever possible, move inline styles to component style blocks:

```svelte
<!-- ✅ Even better -->
<button class="action-button">Click me</button>

<style>
  .action-button {
    font-weight: var(--font-weight-medium);
    font-family: var(--font-buttons);
  }
</style>
```

### Font Weight Reference

Always use the font-weight variables instead of numeric values:

| CSS Variable           | Value | Usage                    |
| ---------------------- | ----- | ------------------------ |
| `--font-weight-normal` | 400   | Regular text             |
| `--font-weight-medium` | 500   | Semi-bold text, emphasis |
| `--font-weight-bold`   | 700   | Bold text, headings      |

### Font Loading and Performance

The site uses locally hosted variable fonts for optimal performance:

#### Variable Font Benefits

- **Single file for multiple weights**: Inter variable font contains all weights (100-900) in one file
- **Reduced HTTP requests**: Fewer font files to download
- **Smaller file size**: Overall smaller download compared to multiple individual font files
- **Precise weight control**: Can use any weight value from 100-900, not just predefined weights

#### Font Loading Strategy

The site implements best practices for font loading:

- **`font-display: swap`**: Text remains visible while fonts load
- **Local font hosting**: Eliminates third-party dependencies
- **Variable fonts**: Reduces the number of font files
- **Font preloading**: Consider adding this for critical fonts:
    ```html
    <link rel="preload" href="/fonts/Inter/Inter-VariableFont_opsz,wght.ttf" as="font" type="font/ttf" crossorigin />
    ```

````

Dark mode is activated by adding the `.dark` class to the `html` element. The CSS variables are then updated with dark mode values.

To toggle dark mode:

```javascript
document.documentElement.classList.toggle("dark");
````
