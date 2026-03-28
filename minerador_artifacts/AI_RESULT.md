```python
# src/api/endpoints.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.services.order_service import OrderService
from src.utils.logger import get_logger

bp = Blueprint('orders', __name__, url_prefix='/api/orders')
logger = get_logger(__name__)


@bp.route('/', methods=['POST'])
@jwt_required()
def create_order():
    user_id = get_jwt_identity()
    data = request.get_json()

    try:
        order = OrderService.create_order(user_id, data)
        return jsonify({'success': True, 'order': order}), 201
    except ValueError as ve:
        logger.warning('Validation error creating order: %s', ve)
        return jsonify({'success': False, 'error': str(ve)}), 400
    except Exception as e:
        logger.error('Unexpected error creating order: %s', e)
        # Fix: Return error response to prevent success toast on 5xx
        return jsonify({'success': False, 'error': 'Internal server error'}), 500
```