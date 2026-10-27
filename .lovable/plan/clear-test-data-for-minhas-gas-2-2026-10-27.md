# Clear test data for Minhas Gas 2

The only matching shop is **Minhas Gas 2**. It has 126 test orders (none completed, no settlements yet).

## What will be removed (this shop only)
- All 126 orders and everything linked to them: order items, payments, chat messages, ratings, refunds, order credits, notifications/tickets pointing to these orders
- Stock movements from these test orders
- Revenue, pending orders and total orders on the merchant dashboard will show 0
- Shop counters reset (total orders 0, rating 0)

## What stays
- The shop itself, its products, prices, riders, staff logins and bank account
- All other shops' data is untouched

## Technical details
- One data-cleanup run scoped to merchant_id `214ed551-cf81-4b59-9aa7-7c49aefac239`: delete child rows (order_items, payments, order_messages, ratings, refunds, order_credits, inventory_movements with reference_order_id, null out support_tickets.related_order_id), then orders; reset merchants.total_orders/rating.
- Stock quantities are not changed (paid test orders deducted stock; merchant can re-set stock in Products). Tell me if you want stock restored instead.
- Verify afterwards with a count query = 0.
