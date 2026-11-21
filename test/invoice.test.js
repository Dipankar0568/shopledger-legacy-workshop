var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');

test('invoice applies the 5%, 12%, and 18% HSN slabs', function () {
  var order = {
    items: [
      { id: 8, name: 'Tea', hsn: '0902', price: 140, qty: 2 },
      { id: 2, name: 'Dal', hsn: '0713', price: 165, qty: 2 },
      { id: 6, name: 'Ghee', hsn: '0405', price: 450, qty: 2 }
    ]
  };

  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.tax, 174.9);
  assert.equal(figures.total, 1684.9);
  assert.deepEqual(figures.rows.map(function (row) { return row.gstPercent; }), [18, 5, 12]);
});

test('invoice applies SAVE10 to the taxable subtotal before calculating GST', function () {
  var order = {
    items: [
      { id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 },
      { id: 4, name: 'Oil', hsn: '1512', price: 190, qty: 2 }
    ],
    coupon: 'SAVE10'
  };

  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.discount, 102);
  assert.equal(figures.tax, 45.9);
  assert.equal(figures.cgst, 22.95);
  assert.equal(figures.sgst, 22.95);
  assert.equal(figures.total, 963.9);
  assert.deepEqual(figures.rows.map(function (row) { return row.lineTax; }), [28.8, 17.1]);
});

test('invoice applies a flat coupon before calculating GST', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [{ id: 8, name: 'Tea', hsn: '0902', price: 1000, qty: 1 }],
    coupon: 'FLAT50'
  });

  assert.equal(figures.discount, 50);
  assert.equal(figures.tax, 171);
  assert.equal(figures.total, 1121);
});

test('invoice honors the SAVE10 maximum discount on a large order', function () {
  var order = {
    items: [{ id: 5, name: 'Groundnut Oil', hsn: '1508', price: 1120, qty: 2 }],
    coupon: 'SAVE10'
  };

  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 104.5);
  assert.equal(figures.total, 2194.5);
});

test('invoice preserves ledger line-level GST rounding', function () {
  var order = {
    items: [
      { id: 1, name: 'Item A', price: 0.03, qty: 1 },
      { id: 2, name: 'Item B', price: 0.03, qty: 1 }
    ]
  };

  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.tax, 0.02);
  assert.equal(figures.total, 0.08);
});

test('an 18% non-coupon invoice keeps the checkout total', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [
      { id: 8, name: 'Tea', hsn: '0902', price: 140, qty: 1 },
      { id: 12, name: 'Sherbet', hsn: '2106', price: 180, qty: 2 }
    ]
  });

  assert.equal(figures.tax, 90);
  assert.equal(figures.total, 590);
  assert.deepEqual(figures.rows.map(function (row) { return row.gstPercent; }), [18, 18]);
});

test('rendered invoice matches the recorded order total without a reconciliation notice', function () {
  var html = invoice.render({
    id: 1002,
    date: '05/01/2022',
    customer: 'Anil Kulkarni',
    items: [
      { id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 },
      { id: 4, name: 'Oil', hsn: '1512', price: 190, qty: 2 }
    ],
    coupon: 'SAVE10',
    subtotal: 1020,
    discount: 102,
    tax: 45.9,
    total: 963.9
  });

  assert.match(html, /Invoice Total<\/td><td class="r">₹963\.90/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
