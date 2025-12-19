I will fix the KDS error and the PDV duplication issue by modifying the following files:

1.  **`apps/desktop/src/pages/cozinha/page.tsx`**:
    *   **Goal**: Fix the `400 Bad Request` error when updating KDS status.
    *   **Change**: Replace the `upsert` call (which relies on a potentially missing unique constraint) with a robust `check -> insert/update` logic. This ensures order status times are saved correctly even if the database schema is slightly desynchronized.

2.  **`apps/desktop/src/offline/services/productsService.ts`**:
    *   **Goal**: Fix the duplication of products in the PDV.
    *   **Change**:
        *   Update `listProducts` to implement **client-side deduplication**. It will filter products by `SKU` (if available) or `Name + Category`, keeping only one instance of each product. This will immediately "clean" the view for the user even if the database contains duplicate rows from previous migration errors.
        *   Update `listCategories` to ensure the deduplication logic is robust (checking for case-insensitive matches).

These changes address the two main issues reported: preventing the application from crashing on KDS updates and cleaning up the visual duplicates in the Point of Sale interface.