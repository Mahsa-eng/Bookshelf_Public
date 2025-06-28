from flask import Flask, jsonify, render_template, request
from pathlib import Path
from PIL import Image
from pdf2image import convert_from_path, exceptions as pdf2exc
import zipfile, os, io, json, logging

app = Flask(__name__, static_folder='static', template_folder='templates')

###############################################################################
# Path configuration
###############################################################################
ROOT = Path(__file__).parent
BOOKS_FOLDER = ROOT / "Books"          # Folder with your PDF/EPUB files
COVERS_FOLDER = ROOT / "static" / "covers"   # Extracted covers are saved here
COVERS_FOLDER.mkdir(parents=True, exist_ok=True)
PLACEHOLDER = COVERS_FOLDER / "placeholder.jpg"  # A generic cover placeholder

# Metadata JSON file (stores user edits)
METADATA_FILE = ROOT / "books_metadata.json"

###############################################################################
# Metadata store helpers (safe load / save)
###############################################################################

def load_metadata() -> dict:
    if not METADATA_FILE.exists():
        # Create an empty JSON file
        METADATA_FILE.write_text("{}", encoding="utf-8")
        return {}
    try:
        with METADATA_FILE.open("r", encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError:
        logging.error("Invalid JSON in books_metadata.json. Re‑initialising file…")
        METADATA_FILE.write_text("{}", encoding="utf-8")
        return {}


def save_metadata(store: dict) -> None:
    with METADATA_FILE.open("w", encoding="utf-8") as f:
        json.dump(store, f, ensure_ascii=False, indent=2)


metadata_store = load_metadata()

###############################################################################
# Cover extraction helper
###############################################################################

def extract_cover(book_path: Path) -> str:
    """Return relative path (under static/) of cover image, extracting if needed."""
    cover_name = book_path.stem.replace(" ", "_") + ".jpg"
    cover_out = COVERS_FOLDER / cover_name

    # If cover already extracted, skip
    if cover_out.exists():
        return f"covers/{cover_name}"

    try:
        if book_path.suffix.lower() == ".pdf":
            try:
                pages = convert_from_path(str(book_path), first_page=1, last_page=1)
                pages[0].save(cover_out, "JPEG")
            except pdf2exc.PDFInfoNotInstalledError:
                logging.warning("poppler-utils not installed; using placeholder for %s", book_path)
                return f"covers/{PLACEHOLDER.name}"
        elif book_path.suffix.lower() == ".epub":
            with zipfile.ZipFile(book_path, "r") as zf:
                candidate = next((f for f in zf.namelist() if "cover" in f.lower() and f.lower().endswith((".jpg", ".jpeg", ".png"))), None)
                if candidate:
                    data = zf.read(candidate)
                    Image.open(io.BytesIO(data)).save(cover_out, "JPEG")
                else:
                    return f"covers/{PLACEHOLDER.name}"
        else:
            return f"covers/{PLACEHOLDER.name}"
        return f"covers/{cover_name}"
    except Exception as exc:
        logging.exception("Cover extract failed for %s", book_path)
        return f"covers/{PLACEHOLDER.name}"

###############################################################################
# Scan folder and merge metadata
###############################################################################

def scan_books_folder():
    books = []
    # Sorted traversal for stable IDs
    for idx, file_path in enumerate(sorted(BOOKS_FOLDER.rglob("*"))):
        if not file_path.is_file() or file_path.suffix.lower() not in {".pdf", ".epub"}:
            continue
        rel = file_path.relative_to(BOOKS_FOLDER)
        category = rel.parts[0] if len(rel.parts) > 1 else "Uncategorized"

        book = {
            "id": idx,
            "title": file_path.stem,
            "path": str(file_path),
            "cover": extract_cover(file_path),
            "extension": file_path.suffix.upper(),
            "filename": file_path.name,
            "category": category
        }
        # Merge user‑edited metadata
        book.update(metadata_store.get(str(idx), {}))
        books.append(book)
    return books

###############################################################################
# Flask routes
###############################################################################

@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/books")
def api_books():
    try:
        return jsonify(scan_books_folder())
    except Exception as exc:
        logging.exception("/api/books failed")
        return jsonify([]), 500


@app.route("/api/edit_book", methods=["POST"])
def api_edit_book():
    data = request.get_json(force=True) or {}
    book_id = str(data.get("id", ""))
    if not book_id:
        return jsonify({"status": "error", "message": "Invalid ID"}), 400

    allowed = {k: data[k] for k in ["title", "authors", "desc", "category"] if k in data}
    if not allowed:
        return jsonify({"status": "error", "message": "No editable fields"}), 400

    metadata_store[book_id] = metadata_store.get(book_id, {}) | allowed
    save_metadata(metadata_store)
    return jsonify({"status": "success", "message": "Book saved"})



###############################################################################
# Entry‑point
###############################################################################

if __name__ == "__main__":
    app.run(debug=True, port=5000)
