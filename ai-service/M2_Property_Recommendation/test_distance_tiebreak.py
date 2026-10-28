import pandas as pd

from recommend import rank_properties


def create_equal_score_properties():
    """
    Create three properties with identical primary
    ranking values.

    Only distance differs:
        Property 101 -> 5 km
        Property 102 -> 10 km
        Property 103 -> unavailable
    """

    return pd.DataFrame(
        {
            "property_id": [101, 102, 103],

            # Same recommendation score
            "recommendation_score": [
                80.0,
                80.0,
                80.0,
            ],

            # Same budget fit
            "budget_score": [
                1.0,
                1.0,
                1.0,
            ],

            # Same amenity coverage
            "amenity_match": [
                1.0,
                1.0,
                1.0,
            ],

            # Distance:
            # Property 101 = 5 km
            # Property 102 = 10 km
            # Property 103 = unavailable
            "approx_distance_km": [
                5.0,
                10.0,
                float("nan"),
            ],

            # Required only because rank_properties()
            # creates its own numeric property ID column.
        }
    )


def test_equal_score_smaller_distance_ranks_first():
    """
    When recommendation score, budget fit, and amenity
    coverage are equal, the property with the smaller
    distance must rank first.
    """

    df = create_equal_score_properties()

    ranked = rank_properties(df)

    ranked_ids = ranked["property_id"].tolist()

    assert ranked_ids == [
        101,  # 5 km
        102,  # 10 km
        103,  # unavailable
    ]


def test_unavailable_distance_is_after_available_distance():
    """
    When all preceding ranking values are tied, properties
    with available distance must appear before properties
    whose distance is unavailable.
    """

    df = create_equal_score_properties()

    ranked = rank_properties(df)

    ranked_ids = ranked["property_id"].tolist()

    assert ranked_ids.index(101) < ranked_ids.index(103)
    assert ranked_ids.index(102) < ranked_ids.index(103)


def test_distance_ordering_is_ascending_for_equal_scores():
    """
    Verify that smaller distance is preferred over larger
    distance when recommendation score and other tie-break
    values are identical.
    """

    df = pd.DataFrame(
        {
            "property_id": [201, 202],
            "recommendation_score": [85.0, 85.0],
            "budget_score": [1.0, 1.0],
            "amenity_match": [0.75, 0.75],
            "approx_distance_km": [12.0, 4.0],
        }
    )

    ranked = rank_properties(df)

    ranked_ids = ranked["property_id"].tolist()

    assert ranked_ids == [
        202,  # 4 km
        201,  # 12 km
    ]


def test_unavailable_distance_does_not_beat_available_distance():
    """
    Explicitly test the NaN behavior.

    Property 301 has no distance.
    Property 302 has a usable distance.

    All other ranking values are identical.
    """

    df = pd.DataFrame(
        {
            "property_id": [301, 302],
            "recommendation_score": [90.0, 90.0],
            "budget_score": [1.0, 1.0],
            "amenity_match": [0.80, 0.80],
            "approx_distance_km": [
                float("nan"),
                7.0,
            ],
        }
    )

    ranked = rank_properties(df)

    ranked_ids = ranked["property_id"].tolist()

    assert ranked_ids == [
        302,  # distance available: 7 km
        301,  # distance unavailable
    ]


def test_higher_recommendation_score_still_beats_closer_distance():
    """
    Distance is only a tie-breaker.

    A property with a higher recommendation score must
    remain ahead even if another property is physically
    closer.
    """

    df = pd.DataFrame(
        {
            "property_id": [401, 402],

            # Property 401 has the higher overall score.
            "recommendation_score": [90.0, 85.0],

            "budget_score": [1.0, 1.0],
            "amenity_match": [0.80, 0.80],

            # Property 402 is much closer, but its overall
            # recommendation score is lower.
            "approx_distance_km": [
                15.0,
                2.0,
            ],
        }
    )

    ranked = rank_properties(df)

    ranked_ids = ranked["property_id"].tolist()

    assert ranked_ids == [
        401,  # Higher recommendation score
        402,  # Lower recommendation score despite being closer
    ]