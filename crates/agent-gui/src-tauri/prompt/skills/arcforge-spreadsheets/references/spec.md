# Spreadsheet Specification

Use a UTF-8 JSON object with a "sheets" array.

## Workbook fields

- "metadata": optional "title", "subject", "creator", "description", "keywords", and "category".
- "theme": optional colors without "#": "primary", "accent", "header_text", and "header_fill".
- "sheets": one or more sheet objects.

## Sheet fields

- "name": required worksheet name.
- "rows": two-dimensional values written from "start_row" and "start_column", both defaulting to 1.
- "set_cells": object mapping cell references to values, or a list such as { "cell": "B2", "value": 42 }.
- "append_rows": rows appended after the current last row.
- "clear_ranges": ranges to clear during "patch".
- "header_row": row number to receive the default ArcForge header style.
- "freeze_panes": cell reference such as "A2".
- "auto_filter": "true" for the used range or an explicit range.
- "column_widths": map column letters or numbers to widths.
- "row_heights": map row numbers to heights.
- "merged_cells": list of ranges.
- "styles": list containing a range and style object.
- "tables": list containing a range, unique name, and optional style.
- "charts": list of chart definitions.
- "show_grid_lines": defaults to "true".
- "tab_color": optional hex color.

## Cell values

JSON scalars are written directly. Strings beginning with "=" become formulas. Use an object for richer cells:

~~~json
{
  "value": 0.28,
  "number_format": "0.0%",
  "style": {
    "font": { "bold": true, "color": "0F172A" },
    "fill": "DBEAFE",
    "alignment": { "horizontal": "center", "vertical": "center" }
  },
  "hyperlink": "https://example.com",
  "comment": "Reviewed source"
}
~~~

Use { "type": "date", "value": "2026-07-22" } or { "type": "datetime", "value": "2026-07-22T09:30:00" } for typed dates.

## Style fields

- "font": "name", "size", "bold", "italic", "underline", "color".
- "fill": a hex color or an object with a "color" field.
- "alignment": "horizontal", "vertical", "wrap_text", "shrink_to_fit", "text_rotation".
- "border": "style" and "color", applied on all sides.
- "number_format": any Excel format code.

## Charts

Supported types are "bar", "column", "line", "pie", and "area".

~~~json
{
  "type": "column",
  "title": "Quarterly revenue",
  "data": "B1:C5",
  "categories": "A2:A5",
  "titles_from_data": true,
  "anchor": "F2",
  "width": 13,
  "height": 7
}
~~~

## Patch behavior

"patch" loads the input workbook, applies only the specified sheet operations, and saves a new ".xlsx". It does not clear existing data unless "clear_ranges" is present. Use "create_if_missing: true" to add a missing sheet.

