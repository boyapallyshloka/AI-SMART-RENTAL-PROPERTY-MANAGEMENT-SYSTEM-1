from enum import Enum
import re

from pydantic import BaseModel, Field


# ============================================================
# 1. SCOUT OPERATIONS
# ============================================================

class ScoutOperation(str, Enum):

    # Backend operations
    RENT_STATUS = "RENT_STATUS"
    PAYMENT_HISTORY = "PAYMENT_HISTORY"
    APPLICATION_STATUS = "APPLICATION_STATUS"
    MAINTENANCE_REQUESTS = "MAINTENANCE_REQUESTS"
    AGREEMENT_DETAILS = "AGREEMENT_DETAILS"

    # M2
    PROPERTY_SEARCH = "PROPERTY_SEARCH"
    PROPERTY_RECOMMENDATION = "PROPERTY_RECOMMENDATION"

    # AI modules
    RENT_PREDICTION = "RENT_PREDICTION"                 # M1
    RENTAL_DEMAND = "RENTAL_DEMAND"                     # M3
    PAYMENT_RISK = "PAYMENT_RISK"                       # M4
    PREDICTIVE_MAINTENANCE = "PREDICTIVE_MAINTENANCE"  # M5
    PROFITABILITY = "PROFITABILITY"                     # M6

    # General
    GENERAL = "GENERAL"


# ============================================================
# 2. SCOUT SOURCES
# ============================================================

class ScoutSource(str, Enum):
    BACKEND = "BACKEND"
    M1 = "M1"
    M2 = "M2"
    M3 = "M3"
    M4 = "M4"
    M5 = "M5"
    M6 = "M6"
    GENERAL = "GENERAL"


# ============================================================
# 3. OPERATION DEFINITION
# ============================================================

class OperationDefinition(BaseModel):
    operation: ScoutOperation
    source: ScoutSource
    required_parameters: list[str] = Field(default_factory=list)
    optional_parameters: list[str] = Field(default_factory=list)
    description: str


# ============================================================
# 4. OPERATION DEFINITIONS
# ============================================================

OPERATION_DEFINITIONS = {

    # --------------------------------------------------------
    # BACKEND
    # --------------------------------------------------------

    ScoutOperation.RENT_STATUS: OperationDefinition(
        operation=ScoutOperation.RENT_STATUS,
        source=ScoutSource.BACKEND,
        required_parameters=["tenant_id"],
        optional_parameters=["property_id"],
        description="Get the current rent or payment status of a tenant.",
    ),

    ScoutOperation.PAYMENT_HISTORY: OperationDefinition(
        operation=ScoutOperation.PAYMENT_HISTORY,
        source=ScoutSource.BACKEND,
        required_parameters=["tenant_id"],
        optional_parameters=["property_id"],
        description="Retrieve payment history for a tenant.",
    ),

    ScoutOperation.APPLICATION_STATUS: OperationDefinition(
        operation=ScoutOperation.APPLICATION_STATUS,
        source=ScoutSource.BACKEND,
        required_parameters=["tenant_id"],
        optional_parameters=["property_id"],
        description="Get the status of a tenant property application.",
    ),

    ScoutOperation.MAINTENANCE_REQUESTS: OperationDefinition(
        operation=ScoutOperation.MAINTENANCE_REQUESTS,
        source=ScoutSource.BACKEND,
        required_parameters=["tenant_id"],
        optional_parameters=["property_id"],
        description="Retrieve maintenance requests for a tenant.",
    ),

    ScoutOperation.AGREEMENT_DETAILS: OperationDefinition(
        operation=ScoutOperation.AGREEMENT_DETAILS,
        source=ScoutSource.BACKEND,
        required_parameters=["tenant_id"],
        optional_parameters=["property_id"],
        description="Retrieve rental agreement details.",
    ),

    # --------------------------------------------------------
    # M2
    # --------------------------------------------------------

    ScoutOperation.PROPERTY_SEARCH: OperationDefinition(
        operation=ScoutOperation.PROPERTY_SEARCH,
        source=ScoutSource.M2,
        required_parameters=[],
        optional_parameters=[
            "tenant_id",
            "preferred_city",
            "max_budget",
            "min_bedrooms",
            "property_type",
            "furnishing",
            "parking",
            "amenities",
            "max_distance",
        ],
        description="Search for properties matching user criteria.",
    ),

    ScoutOperation.PROPERTY_RECOMMENDATION: OperationDefinition(
        operation=ScoutOperation.PROPERTY_RECOMMENDATION,
        source=ScoutSource.M2,
        required_parameters=["tenant_id"],
        optional_parameters=[
            "preferred_city",
            "max_budget",
            "min_bedrooms",
            "property_type",
            "furnishing",
            "parking",
            "amenities",
            "max_distance",
            "top_n",
        ],
        description="Recommend properties based on tenant preferences.",
    ),

    # --------------------------------------------------------
    # M1
    # --------------------------------------------------------

    ScoutOperation.RENT_PREDICTION: OperationDefinition(
        operation=ScoutOperation.RENT_PREDICTION,
        source=ScoutSource.M1,
        required_parameters=[],
        optional_parameters=[
            "city",
            "area",
            "area_type",
            "property_type",
            "bedrooms",
            "bathrooms",
            "furnishing",
        ],
        description="Predict the expected rent for a property.",
    ),

    # --------------------------------------------------------
    # M3
    # --------------------------------------------------------

    ScoutOperation.RENTAL_DEMAND: OperationDefinition(
        operation=ScoutOperation.RENTAL_DEMAND,
        source=ScoutSource.M3,
        required_parameters=[],
        optional_parameters=[
            "city",
            "property_type",
            "time_period",
        ],
        description="Predict rental demand.",
    ),

    # --------------------------------------------------------
    # M4
    # --------------------------------------------------------

    ScoutOperation.PAYMENT_RISK: OperationDefinition(
        operation=ScoutOperation.PAYMENT_RISK,
        source=ScoutSource.M4,
        required_parameters=[],
        optional_parameters=[
            "tenant_id",
            "payment_history",
        ],
        description="Assess payment risk.",
    ),

    # --------------------------------------------------------
    # M5
    # --------------------------------------------------------

    ScoutOperation.PREDICTIVE_MAINTENANCE: OperationDefinition(
        operation=ScoutOperation.PREDICTIVE_MAINTENANCE,
        source=ScoutSource.M5,
        required_parameters=[],
        optional_parameters=[
            "property_id",
        ],
        description="Predict maintenance requirements for a property.",
    ),

    # --------------------------------------------------------
    # M6
    # --------------------------------------------------------

    ScoutOperation.PROFITABILITY: OperationDefinition(
        operation=ScoutOperation.PROFITABILITY,
        source=ScoutSource.M6,
        required_parameters=[],
        optional_parameters=[
            "property_id",
            "monthly_rent",
            "operating_cost",
            "occupancy_rate",
        ],
        description="Estimate property profitability.",
    ),

    # --------------------------------------------------------
    # GENERAL
    # --------------------------------------------------------

    ScoutOperation.GENERAL: OperationDefinition(
        operation=ScoutOperation.GENERAL,
        source=ScoutSource.GENERAL,
        required_parameters=[],
        optional_parameters=[],
        description="Handle general questions.",
    ),
}


# ============================================================
# 5. SCOUT INTENT RESULT
# ============================================================

class ScoutIntent(BaseModel):
    operation: ScoutOperation
    source: ScoutSource
    parameters: dict = Field(default_factory=dict)
    confidence: float = 0.0


# ============================================================
# 6. KEYWORDS
# ============================================================

KEYWORDS = {

    # --------------------------------------------------------
    # BACKEND
    # --------------------------------------------------------

    ScoutOperation.RENT_STATUS: [
        "rent status",
        "rent paid",
        "rent payment status",
        "did i pay rent",
        "did i pay my rent",
        "have i paid rent",
        "have i paid my rent",
        "rent due",
        "rent pending",
    ],

    ScoutOperation.PAYMENT_HISTORY: [
        "payment history",
        "rent history",
        "payment records",
        "past payments",
        "previous payments",
        "payments made",
        "show my payment history",
        "show payment history",
    ],

    ScoutOperation.APPLICATION_STATUS: [
        "application status",
        "application update",
        "my application",
        "rental application",
        "application progress",
    ],

    ScoutOperation.MAINTENANCE_REQUESTS: [
        "maintenance request",
        "maintenance requests",
        "repair request",
        "repair requests",
        "my maintenance",
        "maintenance status",
    ],

    ScoutOperation.AGREEMENT_DETAILS: [
        "rental agreement",
        "lease agreement",
        "agreement details",
        "lease details",
        "agreement expiry",
        "agreement expiration",
        "when does my lease expire",
    ],

    # --------------------------------------------------------
    # M2
    # --------------------------------------------------------

    ScoutOperation.PROPERTY_RECOMMENDATION: [
        "recommend properties",
        "recommend a property",
        "property recommendations",
        "suggest properties",
        "suggest a property",
        "properties for me",
        "find a property for me",

        # Preference-based recommendations
        "show me properties based on my preferences",
        "show properties based on my preferences",
        "properties based on my preferences",
        "properties according to my preferences",
        "find properties based on my preferences",
        "recommend properties based on my preferences",
        "show me properties that match my preferences",
    ],

    ScoutOperation.PROPERTY_SEARCH: [
        "find properties",
        "search properties",
        "find property",
        "search property",
        "find apartment",
        "find apartments",
        "search apartment",
        "search apartments",
        "find a property",
        "find a place",
        "find a home",
        "find a house",
        "find a flat",
        "find flats",
        "properties in",
        "apartments in",
        "houses in",
        "homes in",
    ],

    # --------------------------------------------------------
    # M1
    # --------------------------------------------------------

    ScoutOperation.RENT_PREDICTION: [
        "predict rent",
        "rent prediction",
        "expected rent",
        "estimated rent",
        "rent estimate",
        "how much rent",
    ],

    # --------------------------------------------------------
    # M3
    # --------------------------------------------------------

    ScoutOperation.RENTAL_DEMAND: [
        "rental demand",
        "rent demand",
        "demand for rentals",
        "demand for properties",
        "property demand",
    ],

    # --------------------------------------------------------
    # M4
    # --------------------------------------------------------

    ScoutOperation.PAYMENT_RISK: [
        "payment risk",
        "rent payment risk",
        "default risk",
        "late payment risk",
        "tenant risk",
    ],

    # --------------------------------------------------------
    # M5
    # --------------------------------------------------------

    ScoutOperation.PREDICTIVE_MAINTENANCE: [
        "predict maintenance",
        "maintenance prediction",
        "maintenance needed",
        "maintenance needs",
        "predict repairs",
        "predict maintenance needs",
        "maintenance risk",
        "maintenance prediction for",
        "will this property need maintenance",
        "will my property need maintenance",
        "will property",
        "maintenance required",
        "maintenance forecast",
        "expected maintenance",
        "expected repairs",
        "maintenance cost prediction",
        "predict maintenance cost",
    ],

    # --------------------------------------------------------
    # M6
    # --------------------------------------------------------

    ScoutOperation.PROFITABILITY: [
        "profitability",
        "property profit",
        "profit from property",
        "property returns",
        "rental profit",
        "return on property",
    ],
}


# ============================================================
# 7. SOURCE LOOKUP
# ============================================================

def get_source_for_operation(operation: ScoutOperation) -> ScoutSource:

    definition = OPERATION_DEFINITIONS.get(operation)

    if definition:
        return definition.source

    return ScoutSource.GENERAL


# ============================================================
# 8. PARAMETER EXTRACTION
# ============================================================

def extract_city(text: str):

    known_cities = [
        "hyderabad",
        "bangalore",
        "bengaluru",
        "chennai",
        "mumbai",
        "delhi",
        "pune",
        "kolkata",
    ]

    for city in known_cities:

        if city in text:

            if city == "bengaluru":
                return "Bangalore"

            return city.title()

    return None


def extract_budget(text: str):

    budget_match = re.search(
        r"(?:under|below|upto|up to|max(?:imum)?|within)"
        r"\s*[₹rs.]?\s*([\d,]+)",
        text,
    )

    if budget_match:

        budget = budget_match.group(1).replace(",", "")

        return float(budget)

    return None


def extract_bedrooms(text: str):

    bedroom_match = re.search(
        r"(\d+)\s*(?:bedroom|bedrooms|bhk)",
        text,
    )

    if bedroom_match:
        return int(bedroom_match.group(1))

    return None


def extract_property_type(text: str):

    property_types = {

        "apartment": [
            "apartment",
            "apartments",
            "flat",
            "flats",
        ],

        "house": [
            "house",
            "houses",
        ],

        "villa": [
            "villa",
            "villas",
        ],

        "room": [
            "room",
            "rooms",
        ],
    }

    for property_type, words in property_types.items():

        for word in words:

            if re.search(rf"\b{re.escape(word)}\b", text):
                return property_type

    return None


def extract_furnishing(text: str):

    if "fully furnished" in text:
        return "Fully Furnished"

    if "semi furnished" in text or "semi-furnished" in text:
        return "Semi-Furnished"

    if "unfurnished" in text:
        return "Unfurnished"

    return None


def extract_parking(text: str):

    parking_phrases = [
        "with parking",
        "parking available",
        "has parking",
        "parking facility",
    ]

    for phrase in parking_phrases:

        if phrase in text:
            return True

    return None


def extract_amenities(text: str):

    known_amenities = [
        "gym",
        "swimming pool",
        "pool",
        "security",
        "lift",
        "elevator",
        "balcony",
        "power backup",
        "playground",
        "garden",
        "wifi",
    ]

    amenities = []

    for amenity in known_amenities:

        if amenity in text:

            if amenity == "pool":
                amenity_value = "Swimming Pool"

            elif amenity == "elevator":
                amenity_value = "Lift"

            else:
                amenity_value = amenity.title()

            if amenity_value not in amenities:
                amenities.append(amenity_value)

    return amenities


def extract_distance(text: str):

    distance_match = re.search(
        r"(?:within|less than|under)"
        r"\s*(\d+(?:\.\d+)?)"
        r"\s*(?:km|kilometers)",
        text,
    )

    if distance_match:
        return float(distance_match.group(1))

    return None


def extract_top_n(text: str):

    top_n_match = re.search(
        r"(?:top|show|give me|list)\s+(\d+)",
        text,
    )

    if top_n_match:
        return int(top_n_match.group(1))

    return None


def extract_area(text: str):

    area_match = re.search(
        r"(\d+(?:\.\d+)?)\s*"
        r"(?:sq\.?\s*ft|sqft|square\s*feet)",
        text,
    )

    if area_match:
        return float(area_match.group(1))

    return None


def extract_bathrooms(text: str):

    bathroom_match = re.search(
        r"(\d+)\s*(?:bathroom|bathrooms|bath)",
        text,
    )

    if bathroom_match:
        return int(bathroom_match.group(1))

    return None


def extract_property_age(text: str):

    age_match = re.search(
        r"(?:property age|age)?\s*"
        r"(\d+)\s*(?:year|years)\s*old",
        text,
    )

    if age_match:
        return int(age_match.group(1))

    return None


def extract_occupancy_rate(text: str):

    occupancy_match = re.search(
        r"(?:occupancy rate|occupancy)"
        r"\s*(?:is|of)?\s*"
        r"(\d+(?:\.\d+)?)\s*%",
        text,
    )

    if occupancy_match:
        return float(occupancy_match.group(1))

    return None

def extract_property_id(text: str):
    """
    Extract property ID from the user's message.

    Examples:
        P00001
        P12345
        property P00001
    """

    property_match = re.search(
        r"\bP\d+\b",
        text.upper(),
    )

    if property_match:
        return property_match.group(0)

    return None


# ============================================================
# 9. PARAMETER EXTRACTION
# ============================================================

def extract_property_id(text: str):
    """
    Extract property ID from the user's message.

    Examples:
        P00001
        P12345
        property P00001
    """

    property_match = re.search(
        r"\bP\d+\b",
        text.upper(),
    )

    if property_match:
        return property_match.group(0)

    return None

def extract_parameters(
    message: str,
    operation: ScoutOperation,
) -> dict:

    parameters = {}

    if not message:
        return parameters

    text = message.lower().strip()

    city = extract_city(text)
    property_type = extract_property_type(text)
    furnishing = extract_furnishing(text)
    bedrooms = extract_bedrooms(text)
    parking = extract_parking(text)
    amenities = extract_amenities(text)
    distance = extract_distance(text)

    # --------------------------------------------------------
    # M2 PROPERTY SEARCH / RECOMMENDATION
    # --------------------------------------------------------

    if operation in [
        ScoutOperation.PROPERTY_SEARCH,
        ScoutOperation.PROPERTY_RECOMMENDATION,
    ]:

        if city:
            parameters["preferred_city"] = city

        budget = extract_budget(text)

        if budget is not None:
            parameters["max_budget"] = budget

        if bedrooms is not None:
            parameters["min_bedrooms"] = bedrooms

        if property_type:
            parameters["property_type"] = property_type

        if furnishing:
            parameters["furnishing"] = furnishing

        if parking is not None:
            parameters["parking"] = parking

        if amenities:
            parameters["amenities"] = amenities

        if distance is not None:
            parameters["max_distance"] = distance

        if operation == ScoutOperation.PROPERTY_RECOMMENDATION:

            top_n = extract_top_n(text)

            if top_n is not None:
                parameters["top_n"] = top_n

    # --------------------------------------------------------
    # M1 RENT PREDICTION
    # --------------------------------------------------------

    elif operation == ScoutOperation.RENT_PREDICTION:

        if city:
            parameters["city"] = city

        area = extract_area(text)

        if area is not None:
            parameters["area"] = area

        if property_type:
            parameters["property_type"] = property_type

        if bedrooms is not None:
            parameters["bedrooms"] = bedrooms

        bathrooms = extract_bathrooms(text)

        if bathrooms is not None:
            parameters["bathrooms"] = bathrooms

        if furnishing:
            parameters["furnishing"] = furnishing

    # --------------------------------------------------------
    # M3 RENTAL DEMAND
    # --------------------------------------------------------

    elif operation == ScoutOperation.RENTAL_DEMAND:

        if city:
            parameters["city"] = city

        if property_type:
            parameters["property_type"] = property_type

        time_periods = [
            "this month",
            "next month",
            "this year",
            "next year",
            "last month",
            "last year",
        ]

        for period in time_periods:

            if period in text:

                parameters["time_period"] = period

                break

    # --------------------------------------------------------
    # M5 PREDICTIVE MAINTENANCE
    # --------------------------------------------------------

    elif operation == ScoutOperation.PREDICTIVE_MAINTENANCE:
        
        property_id = extract_property_id(text)
        
        if property_id:
            parameters["property_id"] = property_id
    # --------------------------------------------------------
    # M6 PROFITABILITY
    # --------------------------------------------------------

    elif operation == ScoutOperation.PROFITABILITY:

        budget = extract_budget(text)

        if budget is not None:
            parameters["monthly_rent"] = budget

        occupancy_rate = extract_occupancy_rate(text)

        if occupancy_rate is not None:
            parameters["occupancy_rate"] = occupancy_rate

        operating_cost_match = re.search(
            r"(?:operating cost|operating costs|expenses)"
            r"\s*(?:is|of)?\s*[₹rs.]?\s*([\d,]+)",
            text,
        )

        if operating_cost_match:

            operating_cost = (
                operating_cost_match.group(1)
                .replace(",", "")
            )

            parameters["operating_cost"] = float(
                operating_cost
            )

    # --------------------------------------------------------
    # IMPORTANT:
    # tenant_id is NOT extracted from user text.
    #
    # Later:
    # JWT/session -> authenticated tenant_id
    # --------------------------------------------------------

    return parameters


# ============================================================
# 10. INTENT DETECTION
# ============================================================

def detect_intent(message: str) -> ScoutIntent:

    # --------------------------------------------------------
    # Empty message
    # --------------------------------------------------------

    if not message or not message.strip():

        return ScoutIntent(
            operation=ScoutOperation.GENERAL,
            source=ScoutSource.GENERAL,
            parameters={},
            confidence=0.0,
        )

    text = message.lower().strip()

    # --------------------------------------------------------
    # Intent priority
    # --------------------------------------------------------

    operation_priority = [

        # M2 recommendation first
        ScoutOperation.PROPERTY_RECOMMENDATION,

        # Backend
        ScoutOperation.RENT_STATUS,
        ScoutOperation.PAYMENT_HISTORY,
        ScoutOperation.APPLICATION_STATUS,
        ScoutOperation.MAINTENANCE_REQUESTS,
        ScoutOperation.AGREEMENT_DETAILS,

        # AI modules
        ScoutOperation.RENT_PREDICTION,
        ScoutOperation.RENTAL_DEMAND,
        ScoutOperation.PAYMENT_RISK,
        ScoutOperation.PREDICTIVE_MAINTENANCE,
        ScoutOperation.PROFITABILITY,

        # Generic property search last
        ScoutOperation.PROPERTY_SEARCH,
    ]

    # --------------------------------------------------------
    # Keyword matching
    # --------------------------------------------------------

    for operation in operation_priority:

        for keyword in KEYWORDS.get(operation, []):

            if keyword in text:

                parameters = extract_parameters(
                    message,
                    operation,
                )

                return ScoutIntent(
                    operation=operation,
                    source=get_source_for_operation(
                        operation
                    ),
                    parameters=parameters,
                    confidence=0.90,
                )

    # --------------------------------------------------------
    # PROPERTY SEARCH FALLBACK
    # --------------------------------------------------------
    #
    # Handles natural sentences such as:
    #
    # "Find a 3 bedroom apartment in Hyderabad"
    # "Search for a house in Hyderabad"
    # "I am looking for a villa in Hyderabad"
    #
    # --------------------------------------------------------

    property_search_words = [
        "find",
        "search",
        "looking for",
        "look for",
    ]

    property_words = [
        "apartment",
        "apartments",
        "flat",
        "flats",
        "house",
        "houses",
        "villa",
        "villas",
        "room",
        "rooms",
    ]

    has_search_word = any(
        word in text
        for word in property_search_words
    )

    has_property_word = any(
        word in text
        for word in property_words
    )

    if has_search_word and has_property_word:

        return ScoutIntent(
            operation=ScoutOperation.PROPERTY_SEARCH,
            source=ScoutSource.M2,
            parameters=extract_parameters(
                message,
                ScoutOperation.PROPERTY_SEARCH,
            ),
            confidence=0.90,
        )

    # --------------------------------------------------------
    # GENERAL
    # --------------------------------------------------------

    return ScoutIntent(
        operation=ScoutOperation.GENERAL,
        source=ScoutSource.GENERAL,
        parameters={},
        confidence=0.30,
    )