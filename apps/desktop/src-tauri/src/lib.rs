use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::Emitter;

/// Event name the frontend listens for to trigger the same "open PDF" flow
/// as its own toolbar button, when the user picks File > Open PDF... from
/// the native menu bar instead.
const OPEN_PDF_EVENT: &str = "menu://open-pdf";
const OPEN_PDF_MENU_ID: &str = "open_pdf";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let open_item = MenuItemBuilder::with_id(OPEN_PDF_MENU_ID, "Open PDF…")
                .accelerator("CmdOrCtrl+O")
                .build(app)?;

            let file_menu = SubmenuBuilder::new(app, "File")
                .item(&open_item)
                .separator()
                .item(&PredefinedMenuItem::close_window(app, None)?)
                .build()?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let window_menu = SubmenuBuilder::new(app, "Window")
                .minimize()
                .close_window()
                .build()?;

            let mut menu_builder = MenuBuilder::new(app);

            #[cfg(target_os = "macos")]
            {
                let app_menu = SubmenuBuilder::new(app, "PDF Book Splitter")
                    .about(None)
                    .separator()
                    .services()
                    .separator()
                    .hide()
                    .hide_others()
                    .show_all()
                    .separator()
                    .quit()
                    .build()?;
                menu_builder = menu_builder.item(&app_menu);
            }

            menu_builder = menu_builder
                .item(&file_menu)
                .item(&edit_menu)
                .item(&window_menu);
            let menu = menu_builder.build()?;
            app.set_menu(menu)?;

            app.on_menu_event(move |app_handle, event| {
                if event.id().as_ref() == OPEN_PDF_MENU_ID {
                    let _ = app_handle.emit(OPEN_PDF_EVENT, ());
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
