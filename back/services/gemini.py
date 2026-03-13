import base64
import logging

from config import GEMINI_MODEL, get_gemini_api_key
from schemas import InventoryCount

log = logging.getLogger(__name__)

INVENTORY_PROMPT = """You are counting food inventory from a warehouse or pantry photo. Try to count as accurately as possible.

Rules:
- Classify every visible food item into exactly one of these categories: Beverages, Juices, Cereal, Breakfast, Meat, Fish, Poultry, Frozen, Vegetables, Fruits, Nuts, Soup, Grains, Pasta, Snacks, Spices, Sauces, Condiments, Misc Products.
- Examples: chocolate dip and gingerbread houses → Snacks. Cereal boxes → Cereal. Juice bottles → Juices.
- For each category, output a single quantity (unit size × amount shipped) estimated from the image. Count boxes, bottles, bags, or visible units and estimate how many units are there. Output must be an integer only; no decimals.
- Include every category in your response; use 0 if nothing in the image belongs to that category.
- Do not add or use any category other than the 19 listed above."""

ORDER_FORM_PROMPT = """This image is one PAGE of a warehouse order form with a table.
Your task is OCR + mapping for THIS PAGE ONLY.
Return category totals from the handwritten 'Amount Shipped' column on this page.

IMPORTANT:
- The 'Amount Shipped' column contains HANDWRITTEN numbers. Look specifically for handwritten digits in the column labeled "Amount Shipped" (usually the 2nd to last column).
- Do not confuse 'Amount Ordered' (printed or handwritten) with 'Amount Shipped'. Use the 'Amount Shipped' column.
- If 'Amount Shipped' is empty, assume 0.
- Use the handwritten shipped number as-is.
- DO NOT multiply by case size, unit size, pack count, or any conversion factor.
- If unsure between two digits, prefer the most conservative plausible integer from the handwriting.

Mapping Rules:
- Map each row's "Product Description" to exactly one of these categories: Beverages, Juices, Cereal, Breakfast, Meat, Fish, Poultry, Frozen, Vegetables, Fruits, Nuts, Soup, Grains, Pasta, Snacks, Spices, Sauces, Condiments, Misc Products.
- Example mappings based on the form:
  - "Smoothies", "Hydration Drink", "Protein Shake" -> Beverages or Juices
  - "Cereals - Ralston" -> Cereal
  - "Frozen Mid Ohio Mixed Meat" -> Meat or Frozen
  - "Corn", "Raisins" -> Vegetables or Fruits
  - "Tomato Soup" -> Soup
  - "Mac & Cheese", "Rice", "Pasta" -> Grains or Pasta
  - "Beans", "Lentils" -> Grains or Vegetables (use Grains for dry beans)
  - "Snack Foods", "Candy", "Chocolate Dip" -> Snacks
  - "Peanut Butter", "Dressing" -> Condiments or Sauces
  - "Cleaning Supplies", "Personal Hygiene", "Non-Food" -> Misc Products (or ignore if strictly food inventory, but mapped to Misc for now)

Quantity Rules:
- Extract the HANDWRITTEN 'Amount Shipped' value.
- Output exactly one integer per category (sum of this page only).
- Use 0 for any category not found on the form. No decimals."""


def call_gemini_inventory(image_bytes: bytes, mime_type: str) -> dict | None:
    api_key = get_gemini_api_key()
    if not api_key:
        log.warning("GEMINI_API_KEY (or GOOGLE_API_KEY) not set; skipping Gemini call")
        return None
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain_core.messages import HumanMessage

        model = ChatGoogleGenerativeAI(
            model=GEMINI_MODEL,
            google_api_key=api_key,
        )
        structured_model = model.with_structured_output(InventoryCount)
        b64 = base64.b64encode(image_bytes).decode("utf-8")
        mime = mime_type or "image/jpeg"
        msg = HumanMessage(
            content=[
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{mime};base64,{b64}"},
                },
                {"type": "text", "text": INVENTORY_PROMPT},
            ]
        )
        result = structured_model.invoke([msg])
        if result is not None and isinstance(result, InventoryCount):
            return result.model_dump(by_alias=True)
        return None
    except Exception as e:
        err = str(e).lower()
        if "429" in err or "quota" in err or "resource_exhausted" in err:
            log.warning("Gemini rate limit: %s", e)
            return None
        log.exception("Gemini API error: %s", e)
        return None


def call_gemini_order_form(image_bytes: bytes, mime_type: str) -> dict | None:
    """Extract baseline inventory from an order form image. Same schema as shelf counts."""
    api_key = get_gemini_api_key()
    if not api_key:
        log.warning("GEMINI_API_KEY (or GOOGLE_API_KEY) not set; skipping Gemini call")
        return None
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain_core.messages import HumanMessage

        model = ChatGoogleGenerativeAI(
            model=GEMINI_MODEL,
            google_api_key=api_key,
        )
        structured_model = model.with_structured_output(InventoryCount)
        b64 = base64.b64encode(image_bytes).decode("utf-8")
        mime = mime_type or "image/jpeg"
        msg = HumanMessage(
            content=[
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{mime};base64,{b64}"},
                },
                {"type": "text", "text": ORDER_FORM_PROMPT},
            ]
        )
        result = structured_model.invoke([msg])
        if result is not None and isinstance(result, InventoryCount):
            return result.model_dump(by_alias=True)
        return None
    except Exception as e:
        err = str(e).lower()
        if "429" in err or "quota" in err or "resource_exhausted" in err:
            log.warning("Gemini rate limit: %s", e)
            return None
        log.exception("Gemini API error: %s", e)
        return None
