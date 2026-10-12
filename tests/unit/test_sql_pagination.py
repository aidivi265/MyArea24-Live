import datetime
import pytest
from backend.app.database.models import Business, Product, Offer, ServiceListing, User


def test_business_sql_pagination_and_sorting(client, db_session):
    # Create merchant
    owner = User(email="pagination_merchant@test.com", full_name="Merchant P", role="merchant")
    db_session.add(owner)
    db_session.commit()

    # Create 5 businesses at different locations and ratings
    # Reference user at Connaught Place: 28.6304, 77.2177
    b1 = Business(
        slug="store-near-cp",
        name="Store Near CP",
        owner_id=owner.id,
        category="Retail",
        address="CP Block A",
        locality="Connaught Place",
        city="Delhi",
        latitude=28.6310,  # very close to user
        longitude=77.2180,
        rating=4.0,
        status="active",
        opening_time="00:00",
        closing_time="23:59",
    )
    b2 = Business(
        slug="store-rohini",
        name="Store Rohini",
        owner_id=owner.id,
        category="Retail",
        address="Sector 10",
        locality="Rohini",
        city="Delhi",
        latitude=28.7100,  # ~15 km away
        longitude=77.1200,
        rating=5.0,
        status="active",
        opening_time="00:00",
        closing_time="23:59",
    )
    b3 = Business(
        slug="store-noida",
        name="Store Noida",
        owner_id=owner.id,
        category="Retail",
        address="Sector 18",
        locality="Noida Sector 18",
        city="Noida",
        latitude=28.5700,  # ~12 km away
        longitude=77.3200,
        rating=3.5,
        status="active",
        opening_time="00:00",
        closing_time="23:59",
    )
    b4 = Business(
        slug="store-gurugram",
        name="Store Gurugram",
        owner_id=owner.id,
        category="Retail",
        address="Cyber Hub",
        locality="DLF Phase 2",
        city="Gurugram",
        latitude=28.4900,  # ~25 km away
        longitude=77.0900,
        rating=4.9,
        status="active",
        opening_time="00:00",
        closing_time="23:59",
    )
    b5 = Business(
        slug="store-closed",
        name="Store Closed Late Night",
        owner_id=owner.id,
        category="Retail",
        address="Old Delhi",
        locality="Chandni Chowk",
        city="Delhi",
        latitude=28.6500,
        longitude=77.2300,
        rating=4.2,
        status="active",
        opening_time="03:00",
        closing_time="03:05",  # Closed 99% of the day
    )
    db_session.add_all([b1, b2, b3, b4, b5])
    db_session.commit()

    # Add products & offers to verify batch count aggregation
    prod1 = Product(
        business_id=b1.id,
        name="P1",
        category="Retail",
        local_price=100.0,
    )
    prod2 = Product(
        business_id=b1.id,
        name="P2",
        category="Retail",
        local_price=200.0,
    )
    offer1 = Offer(
        business_id=b1.id,
        title="O1",
        discount_text="10%",
        category="Retail",
        valid_until=datetime.datetime.utcnow() + datetime.timedelta(days=5),
        is_active=True,
    )
    db_session.add_all([prod1, prod2, offer1])
    db_session.commit()

    # 1. Test pagination: page=1, page_size=2
    res = client.get("/api/v1/businesses?page=1&page_size=2")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 5
    assert len(data["items"]) == 2
    assert data["page"] == 1
    assert data["page_size"] == 2
    # Default order without coordinates is rating desc -> b2 (5.0), b4 (4.9)
    assert data["items"][0]["id"] == b2.id
    assert data["items"][1]["id"] == b4.id

    # Page 2
    res_p2 = client.get("/api/v1/businesses?page=2&page_size=2")
    data_p2 = res_p2.json()
    assert data_p2["total"] == 5
    assert len(data_p2["items"]) == 2
    assert data_p2["page"] == 2

    # 2. Test SQL distance sorting
    # user at CP (28.6304, 77.2177)
    res_dist = client.get("/api/v1/businesses?user_lat=28.6304&user_lon=77.2177&page_size=5")
    assert res_dist.status_code == 200
    dist_data = res_dist.json()
    assert dist_data["items"][0]["id"] == b1.id  # Store Near CP must be first!
    assert dist_data["items"][0]["distance_km"] < 0.5
    # Batch counts on Store Near CP
    assert dist_data["items"][0]["active_products_count"] == 2
    assert dist_data["items"][0]["active_offers_count"] == 1


def test_product_sql_pagination_and_sorting(client, db_session):
    owner = User(email="prod_merchant@test.com", full_name="Merchant Prod", role="merchant")
    db_session.add(owner)
    db_session.commit()

    biz = Business(
        slug="product-testing-store",
        name="Product Testing Store",
        owner_id=owner.id,
        category="Tech",
        address="Saket",
        locality="Saket",
        city="Delhi",
        latitude=28.5200,
        longitude=77.2100,
        status="active",
    )
    db_session.add(biz)
    db_session.commit()

    p1 = Product(
        business_id=biz.id,
        name="Budget Cable",
        category="Tech",
        local_price=99.0,
        online_price=199.0,
        is_featured=False,
    )
    p2 = Product(
        business_id=biz.id,
        name="Flagship Earbuds",
        category="Tech",
        local_price=4999.0,
        online_price=5999.0,
        is_featured=True,
    )
    p3 = Product(
        business_id=biz.id,
        name="Midrange Adapter",
        category="Tech",
        local_price=499.0,
        online_price=699.0,
        is_featured=False,
    )
    db_session.add_all([p1, p2, p3])
    db_session.commit()

    # 1. Price Ascending
    res_asc = client.get("/api/v1/products?sort_by=price_asc&page=1&page_size=2")
    assert res_asc.status_code == 200
    d_asc = res_asc.json()
    assert d_asc["total"] == 3
    assert len(d_asc["items"]) == 2
    assert d_asc["items"][0]["local_price"] == 99.0
    assert d_asc["items"][1]["local_price"] == 499.0

    # 2. Price Descending
    res_desc = client.get("/api/v1/products?sort_by=price_desc&page=1&page_size=2")
    assert res_desc.status_code == 200
    d_desc = res_desc.json()
    assert d_desc["items"][0]["local_price"] == 4999.0
    assert d_desc["items"][1]["local_price"] == 499.0

    # 3. Default Relevance (Featured first)
    res_rel = client.get("/api/v1/products?sort_by=relevance")
    assert res_rel.status_code == 200
    d_rel = res_rel.json()
    assert d_rel["items"][0]["name"] == "Flagship Earbuds"


def test_service_sql_pagination(client, db_session):
    s1 = ServiceListing(
        provider_name="Electrician Saket",
        category="Electrician",
        service_area="Saket",
        locality="Saket",
        city="Delhi",
        latitude=28.5200,
        longitude=77.2100,
        phone="+919811001122",
        rating=4.5,
    )
    s2 = ServiceListing(
        provider_name="Plumber Saket",
        category="Plumber",
        service_area="Saket",
        locality="Saket",
        city="Delhi",
        latitude=28.5210,
        longitude=77.2110,
        phone="+919811001133",
        rating=4.9,
    )
    db_session.add_all([s1, s2])
    db_session.commit()

    res = client.get("/api/v1/services?page=1&page_size=1")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 2
    assert len(data["items"]) == 1
    # Rating desc -> Plumber Saket (4.9)
    assert data["items"][0]["provider_name"] == "Plumber Saket"
