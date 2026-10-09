"""add_intelligence_engine_fields

Revision ID: c2e4b6a8d102
Revises: 9d4e61bf8ff6
Create Date: 2026-10-09 19:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c2e4b6a8d102'
down_revision: Union[str, Sequence[str], None] = '9d4e61bf8ff6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema with intelligence engine fields."""
    with op.batch_alter_table('intelligence_insights', schema=None) as batch_op:
        batch_op.add_column(sa.Column('confidence_level', sa.String(length=50), nullable=False, server_default='HIGH (Multi-Source Corroborated)'))
        batch_op.add_column(sa.Column('rule_identifier', sa.String(length=100), nullable=False, server_default='SCENARIO_A_WEATHER_TRAFFIC'))
        batch_op.add_column(sa.Column('data_quality_notes', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('observed_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('next_review_at', sa.DateTime(), nullable=True))
        batch_op.create_index('ix_insights_type_severity', ['insight_type', 'composite_severity'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('intelligence_insights', schema=None) as batch_op:
        batch_op.drop_index('ix_insights_type_severity')
        batch_op.drop_column('next_review_at')
        batch_op.drop_column('observed_at')
        batch_op.drop_column('data_quality_notes')
        batch_op.drop_column('rule_identifier')
        batch_op.drop_column('confidence_level')
