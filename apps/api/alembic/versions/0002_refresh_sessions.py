"""add refresh sessions

Revision ID: 0002_refresh_sessions
Revises: 0001_init
Create Date: 2026-02-15
"""

from alembic import op
import sqlalchemy as sa

revision = '0002_refresh_sessions'
down_revision = '0001_init'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'refresh_sessions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token_id', sa.String(length=64), nullable=False, unique=True),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('revoked_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_refresh_sessions_user_id', 'refresh_sessions', ['user_id'])
    op.create_index('ix_refresh_sessions_token_id', 'refresh_sessions', ['token_id'])
    op.create_index('ix_refresh_sessions_expires_at', 'refresh_sessions', ['expires_at'])
    op.create_index('ix_refresh_sessions_revoked_at', 'refresh_sessions', ['revoked_at'])
    op.create_index('ix_refresh_sessions_created_at', 'refresh_sessions', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_refresh_sessions_created_at', table_name='refresh_sessions')
    op.drop_index('ix_refresh_sessions_revoked_at', table_name='refresh_sessions')
    op.drop_index('ix_refresh_sessions_expires_at', table_name='refresh_sessions')
    op.drop_index('ix_refresh_sessions_token_id', table_name='refresh_sessions')
    op.drop_index('ix_refresh_sessions_user_id', table_name='refresh_sessions')
    op.drop_table('refresh_sessions')
