"""Add MPP schema only to the dedicated, restored local staging database."""
from sqlalchemy import inspect, select, text
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.core.database import engine
from app.models.mpp_purchase import MppPackagePrice, MppPurchaseEvent, MppPurchaseOrder
from app.models.payment_integration import MppTestTransaction, MppTestWebhookEvent
from app.models.checkout_reservation import CheckoutReservation


def main():
    if get_settings().environment != 'mpp_staging':
        raise RuntimeError('Dedicated staging environment required')
    with engine.begin() as connection:
        if connection.scalar(text('SELECT current_database()')) != 'topa_mpp_staging':
            raise RuntimeError('Dedicated staging database required')
        columns = {c['name'] for c in inspect(connection).get_columns('child_profiles')}
        if 'membership_provider' not in columns:
            connection.execute(text('ALTER TABLE child_profiles ADD COLUMN membership_provider VARCHAR(20)'))
        if 'mpp_access_ends_at' not in columns:
            connection.execute(text('ALTER TABLE child_profiles ADD COLUMN mpp_access_ends_at TIMESTAMP WITH TIME ZONE'))
        for model in (MppPackagePrice, MppPurchaseOrder, MppPurchaseEvent, MppTestTransaction, MppTestWebhookEvent, CheckoutReservation):
            model.__table__.create(connection, checkfirst=True)
            for index in model.__table__.indexes:
                index.create(connection, checkfirst=True)
    with Session(engine) as db:
        for code, minor, entitlement, program in [('th_founder_monthly', 19900, 'th_plus', 'TH'), ('ep_founder_monthly', 39900, 'ep_plus', 'EP'), ('th_plus_monthly', 29900, 'th_plus', 'TH'), ('ep_plus_monthly', 59900, 'ep_plus', 'EP')]:
            if not db.get(MppPackagePrice, code):
                db.add(MppPackagePrice(plan_code=code, amount_minor=minor, currency='THB', duration_days=30, entitlement_plan=entitlement, program_type=program, active=True))
        db.commit()
    print('Dedicated staging MPP schema ready; migration history not stamped')


if __name__ == '__main__':
    main()
