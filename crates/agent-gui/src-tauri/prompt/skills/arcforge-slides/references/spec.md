# Presentation Specification

Use a UTF-8 JSON object with a non-empty "slides" array. The default canvas is widescreen 16:9.

## Deck fields

- "metadata": optional "title", "subject", "author", "company", "comments", and "keywords".
- "theme": optional "background", "surface", "primary", "accent", "text", "muted", "inverse", "font", and "font_alt".
- "footer": optional footer text shown on content slides.
- "slides": ordered slide objects.

Colors are six-digit hexadecimal values with or without "#". Coordinates and sizes are in inches only where explicitly exposed.

## Supported slide types

### title

Fields: "title", "subtitle", "kicker", and optional "footer".

### section

Fields: "title", "subtitle", and optional "number".

### bullets

Fields: "title", optional "subtitle", and "bullets". Each bullet may be a string or an object containing "text", "level", and optional "accent".

### two-column

Fields: "title", optional "subtitle", "left", and "right". Each column contains "heading" and "bullets".

### metrics

Fields: "title", optional "subtitle", and "metrics". Each metric contains "label", "value", and optional "delta".

### table

Fields: "title", optional "subtitle", "columns", "rows", and optional "column_widths". Keep tables small enough to fit one slide.

### chart

Fields: "title", optional "subtitle", "chart_type", "categories", and "series".

Supported chart types: "column", "bar", "line", "area", "pie", and "doughnut".

~~~json
{
  "type": "chart",
  "title": "Revenue trend",
  "chart_type": "column",
  "categories": ["Q1", "Q2", "Q3", "Q4"],
  "series": [
    { "name": "Revenue", "values": [128, 156, 181, 205] },
    { "name": "Cost", "values": [76, 88, 97, 108] }
  ]
}
~~~

### image

Fields: "title", "image", optional "caption", and optional "fit" with "contain" or "cover". Relative image paths resolve from the JSON specification directory.

### quote

Fields: "quote", optional "attribution", and optional "title".

### closing

Fields: "title", optional "subtitle", and optional "contact".

## Optional slide fields

- "notes": plain text copied into the slide notes area when supported by the installed python-pptx version.
- "background": per-slide background color.
- "accent": per-slide accent color.

## Content limits

- Keep titles under roughly 60 characters.
- Prefer no more than 6 top-level bullets.
- Prefer no more than 4 metric cards.
- Keep tables under roughly 8 columns and 12 rows.
- Split dense content across multiple slides instead of shrinking text below readable sizes.

