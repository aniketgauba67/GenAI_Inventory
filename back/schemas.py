from pydantic import BaseModel, Field
try:
    from .inventory_domain import INVENTORY_CATEGORIES
except ImportError:
    from inventory_domain import INVENTORY_CATEGORIES


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


class LoginRequest(BaseModel):
    """Credentials submitted by the frontend auth client."""

    username: str = Field(min_length=1, description="Pantry identifier or director username")
    password: str = Field(min_length=1, description="Raw password supplied by the user")


class AuthenticatedUser(BaseModel):
    """Normalized user record returned to the frontend after a successful login."""

    id: str
    name: str
    pantryId: str
    role: str
    email: str | None = None


class LoginResponse(BaseModel):
    """Auth endpoint result consumed by the NextAuth credentials provider."""

    ok: bool
    user: AuthenticatedUser | None = None
    error: str | None = None


class DirectorPasswordUpdateRequest(BaseModel):
    """Payload for updating the single director account password."""

    email: str = Field(min_length=1, description="Director account email")
    newPassword: str = Field(min_length=1, description="New raw password for the director account")


class DirectorPasswordUpdateResponse(BaseModel):
    """Result of a director password update attempt."""

    ok: bool
    message: str | None = None
    error: str | None = None


class PantryCredentialSummary(BaseModel):
    """Director dashboard row summarizing one pantry's auth setup."""

    pantryId: str
    name: str
    location: str | None = None
    hasCredentials: bool


class PantryCredentialRegistryResponse(BaseModel):
    """Collection of pantry auth rows for the director dashboard."""

    ok: bool
    pantries: list[PantryCredentialSummary] = Field(default_factory=list)
    error: str | None = None


class PantryPasswordUpdateRequest(BaseModel):
    """Payload for creating or rotating one pantry password."""

    pantryId: str = Field(min_length=1, description="Numeric pantry identifier")
    newPassword: str = Field(min_length=1, description="New raw password for the pantry")


class PantryPasswordUpdateResponse(BaseModel):
    """Result of one pantry password update request."""

    ok: bool
    message: str | None = None
    error: str | None = None


class PantryCreateRequest(BaseModel):
    """Payload used by the director dashboard to create a new pantry login."""

    name: str = Field(min_length=1, description="Pantry name")
    location: str | None = Field(default=None, description="Pantry location")
    newPassword: str = Field(min_length=1, description="Initial pantry login password")


class PantryCreateResponse(BaseModel):
    """Result of creating a pantry and setting its first login credentials."""

    ok: bool
    pantry: PantryCredentialSummary | None = None
    message: str | None = None
    error: str | None = None


class PantryManageUpdateRequest(BaseModel):
    """Patch-like payload for editing pantry profile and/or rotating password.

    Any blank/None field should be interpreted as "no change".
    """

    pantryId: str = Field(min_length=1, description="Numeric pantry identifier")
    name: str | None = None
    location: str | None = None
    newPassword: str | None = None


class PantryManageUpdateResponse(BaseModel):
    """Result of an update to pantry profile/credentials."""

    ok: bool
    message: str | None = None
    error: str | None = None


class PantryCredentialDeleteRequest(BaseModel):
    """Request payload for removing a pantry login credential record."""

    pantryId: str = Field(min_length=1, description="Numeric pantry identifier")


class PantryCredentialDeleteResponse(BaseModel):
    """Result of removing pantry login credentials."""

    ok: bool
    message: str | None = None
    error: str | None = None
