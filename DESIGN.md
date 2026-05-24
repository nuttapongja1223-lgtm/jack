# Design System: Earth Tone Web App

This document outlines the design system for the any web application, a clean and functional interface designed for plain and minima design.

## 1. Design Principles

*   **Clarity**: Minimalist interface focusing on user input and clear results.
*   **Accessibility**: High contrast text and clearly defined interactive elements.
*   **Modernity**: Utilizing the Inter typeface and subtle shadows for a contemporary feel.

---

## 2. Color Palette

The system uses a neutral, sophisticated palette with high-contrast accents.

| Category | Color Name | Hex / RGB | Usage |
| :--- | :--- | :--- | :--- |
| **Background** | Canvas | `rgb(249, 249, 247)` | Main page background |
| **Surface** | White | `#FFFFFF` | Cards, input backgrounds |
| **Primary** | Ink | `#1A1A1A` | Primary buttons, headings, text |
| **Secondary** | Muted | `#888780` | Placeholders, secondary icons |
| **Border** | Subtile Border | `rgba(0, 0, 0, 0.12)` | Input and card outlines |
| **Accent** | Hover State | `#F1EFE8` | Button hover backgrounds |

---

## 3. Typography

The system relies on the **Inter** font family for its readability and clean aesthetic.

*   **Primary Font**: `Inter`, system-ui, -apple-system, sans-serif.

### Type Scale

| Level | Size | Weight | Color | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Heading 1** | 23px | 600 (Semi-bold) | `#1A1A1A` | Main page title |
| **Heading 2** | 18px | 600 (Semi-bold) | `#1A1A1A` | Section titles with icons |
| **Label** | 14px | 500 (Medium) | `#1A1A1A` | Form labels |
| **Body** | 14px | 400 (Regular) | `#1A1A1A` | General text, inputs |
| **Placeholder**| 14px | 400 (Regular) | `#888780` | Input hints |

---

## 4. Components

### 4.1 Buttons

| Variant | Styles | Interactive States |
| :--- | :--- | :--- |
| **Primary** | Background: `#1A1A1A`, Text: `#FFFFFF`, Radius: `8px`, Padding: `0px 32px` | Focus: Ring offset 2px |
| **Secondary** | Background: `#FFFFFF`, Text: `#1A1A1A`, Border: `1px solid rgba(0,0,0,0.12)`, Radius: `8px` | Hover: `#F1EFE8` |

### 4.2 Inputs & Form Fields

*   **Corner Radius**: `8px`
*   **Border**: `1px solid rgba(0, 0, 0, 0.12)`
*   **Padding**: `8px 12px`
*   **Focus State**: `2px` ring with color `#1A1A1A`.

### 4.3 Cards

*   **Standard Card**: White background, `12px` border radius, subtle shadow (`0 1px 3px rgba(0,0,0,0.1)`).
*   **Empty/Summary State**: Transparent background with `1px dashed rgba(0, 0, 0, 0.15)` border and `12px` radius.

---

## 5. Layout & Spacing

*   **Container**: Centered max-width container for the form.
*   **Spacing Unit**: Primarily uses a 4px/8px baseline.
*   **Section Gap**: Large vertical spacing between main form sections.
*   **Responsive**: Uses a flexible grid that stacks elements on mobile and shows the summary sidebar on larger screens.

---

## 6. Iconography

*   **Library**: SVG-based icons (Heroicons/Lucide style).
*   **Size**: Typically `18px` or `20px` for section headers.
*   **Stroke**: Thin to medium stroke weight to match the typography.

---

## 7. Technical Implementation

*   **Framework**: [Tailwind CSS](https://tailwindcss.com/)
*   **Base Styles**: `antialiased`, `min-h-full`, `flex flex-col`.
*   **Utilities**: Extensive use of `rounded-lg`, `shadow-sm`, and `gap` utilities for layout.
