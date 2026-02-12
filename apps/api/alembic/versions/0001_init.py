"""init

Revision ID: 0001_init
Revises: 
Create Date: 2026-02-12
"""

from alembic import op
import sqlalchemy as sa

revision = '0001_init'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('workspaces', sa.Column('id', sa.Integer(), primary_key=True), sa.Column('name', sa.String(200), nullable=False, unique=True))
    op.create_table('users',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('workspace_id', sa.Integer(), sa.ForeignKey('workspaces.id'), nullable=False),
        sa.Column('role', sa.Enum('operator','promoter', name='role'), nullable=False),
        sa.Column('full_name', sa.String(200), nullable=False),
        sa.Column('username', sa.String(100)),
        sa.Column('phone', sa.String(50)),
        sa.Column('telegram_id', sa.Integer(), unique=True),
        sa.Column('is_ready', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('suspicious_note', sa.Text()),
        sa.Column('password_hash', sa.String(255), nullable=False),
    )
    op.create_index('ix_users_workspace_id', 'users', ['workspace_id'])
    op.create_table('work_types',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('workspace_id', sa.Integer(), sa.ForeignKey('workspaces.id'), nullable=False),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('price_per_unit', sa.Numeric(10,2), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
        sa.UniqueConstraint('workspace_id','name', name='uq_worktype_name')
    )
    op.create_table('addresses',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('workspace_id', sa.Integer(), sa.ForeignKey('workspaces.id'), nullable=False),
        sa.Column('district', sa.String(120)),
        sa.Column('street', sa.String(120), nullable=False),
        sa.Column('building', sa.String(40), nullable=False),
        sa.Column('lat', sa.Float()),
        sa.Column('lng', sa.Float()),
        sa.Column('comment', sa.Text()),
    )
    op.create_table('orders',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('workspace_id', sa.Integer(), sa.ForeignKey('workspaces.id'), nullable=False),
        sa.Column('promoter_id', sa.Integer(), sa.ForeignKey('users.id')),
        sa.Column('created_by_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('title', sa.String(180), nullable=False),
        sa.Column('comment', sa.Text()),
        sa.Column('deadline_at', sa.DateTime()),
        sa.Column('status', sa.Enum('draft','assigned','in_progress','review','payment','completed', name='orderstatus'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False)
    )
    op.create_table('order_items',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('order_id', sa.Integer(), sa.ForeignKey('orders.id', ondelete='CASCADE'), nullable=False),
        sa.Column('address_id', sa.Integer(), sa.ForeignKey('addresses.id'), nullable=False),
        sa.Column('comment', sa.Text()),
    )
    op.create_table('order_item_work_types',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('order_item_id', sa.Integer(), sa.ForeignKey('order_items.id', ondelete='CASCADE'), nullable=False),
        sa.Column('work_type_id', sa.Integer(), sa.ForeignKey('work_types.id'), nullable=False),
        sa.UniqueConstraint('order_item_id','work_type_id', name='uq_order_item_worktype')
    )
    op.create_table('photos',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('workspace_id', sa.Integer(), sa.ForeignKey('workspaces.id'), nullable=False),
        sa.Column('order_item_id', sa.Integer(), sa.ForeignKey('order_items.id'), nullable=False),
        sa.Column('work_type_id', sa.Integer(), sa.ForeignKey('work_types.id'), nullable=False),
        sa.Column('uploader_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('file_path', sa.String(255), nullable=False),
        sa.Column('sha256_hash', sa.String(64), nullable=False),
        sa.Column('uploaded_at', sa.DateTime(), nullable=False),
        sa.Column('geo_lat', sa.Float()),
        sa.Column('geo_lng', sa.Float()),
        sa.Column('status', sa.Enum('pending','accepted','rejected', name='photostatus'), nullable=False),
        sa.Column('reject_reason', sa.Text()),
        sa.UniqueConstraint('workspace_id','sha256_hash', name='uq_photo_hash')
    )
    op.create_table('payouts',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('workspace_id', sa.Integer(), sa.ForeignKey('workspaces.id'), nullable=False),
        sa.Column('order_id', sa.Integer(), sa.ForeignKey('orders.id'), nullable=False),
        sa.Column('promoter_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('amount_preliminary', sa.Numeric(10,2), nullable=False),
        sa.Column('amount_final', sa.Numeric(10,2), nullable=False),
        sa.Column('status', sa.Enum('review','to_pay','paid', name='payoutstatus'), nullable=False)
    )


def downgrade() -> None:
    op.drop_table('payouts')
    op.drop_table('photos')
    op.drop_table('order_item_work_types')
    op.drop_table('order_items')
    op.drop_table('orders')
    op.drop_table('addresses')
    op.drop_table('work_types')
    op.drop_table('users')
    op.drop_table('workspaces')
