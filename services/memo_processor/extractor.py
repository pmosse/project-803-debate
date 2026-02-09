import os


def extract_text(file_path: str) -> str:
    """Extract text from PDF or DOCX files."""
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        return extract_pdf(file_path)
    elif ext == ".docx":
        return extract_docx(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")


def extract_pdf(file_path: str) -> str:
    """Extract text from PDF using pymupdf4llm."""
    import pymupdf4llm

    text = pymupdf4llm.to_markdown(file_path)

    # Check if text is mostly empty (scanned image PDF)
    stripped = text.strip()
    if len(stripped) < 50:
        raise ValueError(
            "PDF appears to be a scanned image. Please upload a text-based PDF."
        )

    return stripped


def extract_docx(file_path: str) -> str:
    """Extract text from DOCX using python-docx."""
    from docx import Document

    doc = Document(file_path)
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    text = "\n\n".join(paragraphs)

    if len(text.strip()) < 50:
        raise ValueError("Document appears to be empty or unreadable.")

    return text
