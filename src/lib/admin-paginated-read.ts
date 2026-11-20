type Key = string | number;
type Page<T> = { data: T[] | null; error: unknown };

export async function readAllAdminRows<T extends { id: Key }>(
  fetchPage: (after: T["id"] | null) => PromiseLike<Page<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  const maxPageRequests = 201;
  let after: T["id"] | null = null;
  for (let attempt = 0; attempt < maxPageRequests; attempt++) {
    const { data, error } = await fetchPage(after);
    if (error || !data) throw new Error("admin_page_unavailable");
    if (data.length === 0) return rows;
    for (const row of data) {
      if ((typeof row.id !== "number" && typeof row.id !== "string") ||
          (after !== null && !(row.id > after))) throw new Error("admin_page_order_incompatible");
      rows.push(row);
      after = row.id;
    }
  }
  // Never present bounded/partial counts as full totals.
  throw new Error("admin_overview_volume_limit");
}
