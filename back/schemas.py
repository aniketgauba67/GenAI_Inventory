from pydantic import BaseModel, Field

INVENTORY_CATEGORIES = [
    "Beverages",
    "Juices",
    "Cereal",
    "Breakfast",
    "Meat",
    "Fish",
    "Poultry",
    "Frozen",
    "Vegetables",
    "Fruits",
    "Nuts",
    "Soup",
    "Grains",
    "Pasta",
    "Snacks",
    "Spices",
    "Sauces",
    "Condiments",
    "Misc Products",
]


class InventoryCount(BaseModel):
    """Quantity per category. Integer only, no decimals."""

    Beverages: int = Field(default=0, description="Quantity for Beverages (integer)")
    Juices: int = Field(default=0, description="Quantity for Juices (integer)")
    Cereal: int = Field(default=0, description="Quantity for Cereal (integer)")
    Breakfast: int = Field(default=0, description="Quantity for Breakfast (integer)")
    Meat: int = Field(default=0, description="Quantity for Meat (integer)")
    Fish: int = Field(default=0, description="Quantity for Fish (integer)")
    Poultry: int = Field(default=0, description="Quantity for Poultry (integer)")
    Frozen: int = Field(default=0, description="Quantity for Frozen (integer)")
    Vegetables: int = Field(default=0, description="Quantity for Vegetables (integer)")
    Fruits: int = Field(default=0, description="Quantity for Fruits (integer)")
    Nuts: int = Field(default=0, description="Quantity for Nuts (integer)")
    Soup: int = Field(default=0, description="Quantity for Soup (integer)")
    Grains: int = Field(default=0, description="Quantity for Grains (integer)")
    Pasta: int = Field(default=0, description="Quantity for Pasta (integer)")
    Snacks: int = Field(default=0, description="Quantity for Snacks (integer)")
    Spices: int = Field(default=0, description="Quantity for Spices (integer)")
    Sauces: int = Field(default=0, description="Quantity for Sauces (integer)")
    Condiments: int = Field(default=0, description="Quantity for Condiments (integer)")
    Misc_Products: int = Field(default=0, alias="Misc Products", description="Quantity for Misc Products (integer)")
