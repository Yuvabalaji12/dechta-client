# DECHTA Project - Development Tasks
**Assignee:** Yuva Balaji  
**Feature:** Category-Aware Search & Auto-Suggest  

---

## Task 1: Database Search Indexing & Tagging
**Objective:** Ensure the product database is structured to support keyword-to-category mapping so that broad search terms return relevant category results.

**Implementation Details:**
* **Search Tags:** Add a `search_tags` or `keywords` column (array of text or JSONB) to the products or categories table to associate broad terms (e.g., "phone", "mobile") with specific categories (e.g., "Electronics -> Smartphones").
* **Full-Text Search:** If using PostgreSQL, implement Full-Text Search (FTS) using `tsvector` and `tsquery` on product names, descriptions, and category names for high-performance querying.

**Acceptance Criteria:**
* [ ] Database schema is updated to include search tags/keywords.
* [ ] Existing products/categories are migrated with relevant search keywords.
* [ ] Database indexes are created on the searchable columns to ensure fast read times.

---

## Task 2: Backend Search API & Category Inference
**Objective:** Create a fast, efficient API endpoint that takes a search keyword, determines the most likely category, and returns a mix of direct product matches and category suggestions.

**Implementation Details:**
* **Endpoint:** `GET /api/v1/search?q={keyword}`
* **Logic Flow:**
  1. Check if `{keyword}` matches a specific category or search tag.
  2. If it matches a category, fetch top products from that *entire category*.
  3. If no direct category match, perform a wildcard/full-text search across product names and descriptions.
* **Response Payload:** Return a structured JSON containing both `suggested_categories` and `products`.

**Acceptance Criteria:**
* [ ] API endpoint successfully handles GET requests with query parameters.
* [ ] Logic accurately maps broad keywords to specific categories.
* [ ] Payload is strictly typed and optimized for low-latency frontend rendering.
* [ ] API handles empty states or "no results found" gracefully.

---

## Task 3: Frontend Search Bar & Auto-Suggest UI (React)
**Objective:** Build a responsive, interactive search component in the navigation bar that displays real-time suggestions without overwhelming the backend.

**Implementation Details:**
* **Debouncing:** Implement a debounce function (e.g., 300ms) on the search input to prevent firing API calls on every single keystroke.
* **State Management:** Manage `searchTerm`, `suggestions` (categories/products), and `isLoading` states.
* **UI Component:** Create a dropdown interface attached to the search input that displays "Suggested Categories" at the top and "Products" below it.
* **Routing:** Clicking a suggested category should navigate the user to `/category/{id}`, while clicking a product should navigate to `/product/{id}`.

**Acceptance Criteria:**
* [ ] Search input captures user text and triggers the API only after the debounce delay.
* [ ] Auto-suggest dropdown renders cleanly and displays both category suggestions and product matches.
* [ ] UI handles loading states (e.g., a small spinner inside the search bar) and error states.
* [ ] Clicking on a suggestion routes the user to the correct DECHTA page.
* [ ] Clicking outside the search component properly closes the dropdown.