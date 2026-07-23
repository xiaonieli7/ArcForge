sheet = workbook.active
sheet.title = "Runtime Smoke"
sheet.append(["Month", "Revenue", "Cost"])
for row in [
    ["Jan", 120, 75],
    ["Feb", 135, 82],
    ["Mar", 148, 89],
]:
    sheet.append(row)

sheet["D1"] = "Profit"
for row_index in range(2, sheet.max_row + 1):
    sheet.cell(row=row_index, column=4, value=f"=B{row_index}-C{row_index}")

for cell in sheet[1]:
    cell.font = Font(bold=True, color="FFFFFF")
    cell.fill = PatternFill("solid", fgColor="0F172A")

chart = LineChart()
chart.title = "Revenue and cost"
chart.add_data(
    Reference(sheet, min_col=2, max_col=3, min_row=1, max_row=4),
    titles_from_data=True,
)
chart.set_categories(Reference(sheet, min_col=1, min_row=2, max_row=4))
sheet.add_chart(chart, "F2")
