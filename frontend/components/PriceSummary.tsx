export function PriceSummary({
  totalPrice,
  depositAmount,
  outstandingAmount,
}: {
  totalPrice: number;
  depositAmount: number;
  outstandingAmount: number;
}) {
  return (
    <dl className="grid grid-cols-3 gap-4 text-sm">
      <div>
        <dt className="text-muted-foreground">Total</dt>
        <dd className="font-medium">RM {totalPrice.toFixed(2)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Deposit</dt>
        <dd className="font-medium">RM {depositAmount.toFixed(2)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Outstanding</dt>
        <dd
          className={`font-medium ${outstandingAmount > 0 ? "text-destructive" : "text-green-700"}`}
        >
          RM {outstandingAmount.toFixed(2)}
        </dd>
      </div>
    </dl>
  );
}
