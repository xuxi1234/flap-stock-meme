"""Build unsigned BSC airdrop transactions. No RPC, signing or broadcast."""
import csv, hashlib, json, pathlib, re
from decimal import Decimal
ROOT = pathlib.Path(__file__).resolve().parent
SOURCE = ROOT / "recipients.csv"
EXPECTED = "b4f86eacdb562f0798f4650a351952b978742f92bfa90103f620cdf89b338ec4"
ACCOUNT = "0x74a7D3198905C3b4BA53574C2DffEF3aa4e569aA"
TOKEN = "0x4b112e1ed0c0cb332d2b39e5dae3bba882f67777"
DISTRIBUTOR = "0x369890cb7a233be14d33fd4265b26afadce00bc0"
AMOUNT = 777700000000000000
def word(n):
    return format(n, "064x")
def address(a):
    return a[2:].lower().rjust(64, "0")
def request(to, data):
    return {"chainId": 56, "from": ACCOUNT, "to": to, "value": "0x0", "data": data}
def build():
    raw = SOURCE.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == EXPECTED, "Recipient checksum mismatch"
    rows = list(csv.DictReader(raw.decode("utf-8-sig").splitlines()))
    recipients = [r["address"].lower() for r in rows]
    assert len(recipients) == len(set(recipients)) == 7031
    assert all(re.fullmatch(r"0x[0-9a-f]{40}", a) for a in recipients)
    forbidden = {ACCOUNT.lower(), DISTRIBUTOR.lower(), "0x" + "0" * 40}
    assert not forbidden.intersection(recipients), "Distributor rejects a recipient; do not silently remove it"
    total = len(recipients) * AMOUNT
    batches = []
    for index, start in enumerate(range(0, len(recipients), 200)):
        group = recipients[start:start + 200]
        batch_id = hashlib.sha256(f"butterfly:56:snapshot0922:{EXPECTED}:{index}".encode()).hexdigest()
        # distribute(address,bytes32,address[],uint256[]), selector from repository artifact.
        first_offset = 128
        second_offset = first_offset + 32 * (len(group) + 1)
        data = "0x8b46a263" + address(TOKEN) + batch_id + word(first_offset) + word(second_offset)
        data += word(len(group)) + "".join(address(a) for a in group)
        data += word(len(group)) + word(AMOUNT) * len(group)
        batches.append({
            "batch": index + 1, "batchId": "0x" + batch_id,
            "recipientCount": len(group), "recipients": group,
            "minimumSecondsAfterPreviousConfirmation": 0 if index == 0 else 3600,
            "transaction": request(DISTRIBUTOR, data)
        })
    assert len(batches) == 36 and batches[-1]["recipientCount"] == 31
    return {
        "status": "unsigned-not-started", "chainId": 56, "snapshotBlock": 123329990,
        "sourceSha256": EXPECTED, "account": ACCOUNT, "token": TOKEN,
        "distributor": DISTRIBUTOR, "recipientCount": len(recipients),
        "amountPerRecipient": "0.7777", "totalTokens": str(Decimal(total) / Decimal(10**18)),
        "gasBudgetBNB": None, "gasBudgetMeaning": "No cumulative gas spending cap requested",
        "intervalSeconds": 3600, "batchCount": len(batches),
        "scheduleEnforcedByThisBuilder": False,
        "approvalIfNeeded": request(TOKEN, "0x095ea7b3" + address(DISTRIBUTOR) + word(total)),
        "resetApprovalIfRequired": request(TOKEN, "0x095ea7b3" + address(DISTRIBUTOR) + word(0)),
        "batches": batches
    }
if __name__ == "__main__":
    plan = build()
    out = ROOT / "output"
    out.mkdir(exist_ok=True)
    (out / "unsigned-plan.json").write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({k: plan[k] for k in ["status", "recipientCount", "batchCount", "totalTokens", "intervalSeconds", "gasBudgetBNB"]}))
