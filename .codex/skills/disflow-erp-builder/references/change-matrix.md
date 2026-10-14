# Change Matrix

Use this reference when work crosses layers or changes an approved contract.

| Change | Read first | Usually update | Verification focus |
|---|---|---|---|
| CRM, visit, quote, target | 10 | 02, 03, 04, 06, 07, 08 | period close, attribution, approval, location privacy |
| SO, credit, fulfillment | 10, 11 | 02–08 | automatic gate, unlock only, allocation, partial fulfillment, POD |
| Procurement/inbound | 11, 14 | 02–08 | PR consolidation, supplier split, PO remainder, GR quality, landed cost |
| AR/AP/cash | 12 | 02–08, 20 | open-item settlement, due date, withholding, reconciliation |
| Accounting/closing/report | 12 | 02–08, 09 | double entry, period lock, reversal, report reconciliation |
| HR/payroll | 13 | 02–08, 12, 09 | private access, snapshot cut-off, effective policy, parallel-run gate |
| Master/config/IAM | 14, 15, 39, 40 | 02–08 | editable OPS policy, versioning, duplicate prevention, server authorization, invariant boundaries |
| Tax/Coretax | 12 | 02–08 | effective rules, WAPU split, source linkage, XML validation |
| Dashboard/KPI | 09 plus formula owner | 02–08 | posted source, freshness, no double counting, permission suppression |
| Platform/security | 05, 15, 39 | 01, 02, 04, 08 | session revocation, cache isolation, backup/restore, RPO/RTO |

For every row, use `00-document-map.md` when ownership is unclear. The latest user decision outranks the register, requirements, domain document, and technical model in that order; synchronize the lower-priority sources instead of leaving a conflict.
