// Re-exports the platform-agnostic engine so existing consumers of the
// published "pdf-book-splitter" package who import it as a library (rather
// than running its bin) keep working unchanged after the engine moved to
// @pdf-book-splitter/core.
export * from "@pdf-book-splitter/core";
