"""add tts_url to interview_messages

Revision ID: 5507d713a714
Revises: 2acbb1265a4b
Create Date: 2025-11-30 21:37:27.951965

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5507d713a714'
down_revision: Union[str, None] = '2acbb1265a4b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
