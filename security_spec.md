# Security Spec: Employee GPS & Face Recognition Attendance System

## 1. Data Invariants
1. `attendances` records must contain valid `employeeId`, `employeeName`, `date`, `checkInTime`, and valid coordinate numbers.
2. An attendance record's `date` and `employeeId` cannot be forged by an anonymous unauthorized entity.
3. String sizes must conform to boundaries (max 100 for names, max 30 for NIK, max 500 for notes).
4. `employees` records require `nik`, `name`, `department`, and `isActive` boolean.
5. Path IDs must be valid alphanumeric strings matching `^[a-zA-Z0-9_\-]+$` and size <= 128 chars.
6. Default deny catch-all prevents unauthorized modifications to unregistered collections.

## 2. The Dirty Dozen Payloads (Designed to Fail)
1. Injecting 5MB string in employee name -> REJECT (length limit)
2. Creating attendance record with missing `employeeId` -> REJECT (required keys)
3. Setting negative or invalid latitude/longitude format -> REJECT (type check)
4. Spoofing admin privileges in client document -> REJECT
5. Writing to arbitrary unmapped paths like `/malicious/{doc}` -> REJECT (default deny)
6. Updating employee record with rogue fields `__role: superadmin` -> REJECT (strict keys)
7. Writing attendance with empty date -> REJECT (empty string)
8. Document ID with malicious directory traversal `../../etc/passwd` -> REJECT (isValidId regex)
9. Modifying immutable field `createdAt` on an existing attendance -> REJECT (immutability rule)
10. Deleting office settings by non-authorized user -> REJECT
11. Massive batch of corrupted attendances with wrong types -> REJECT
12. Null byte injection in employee ID -> REJECT

## 3. Test Runner Specification
Tests verify that standard operations within valid bounds succeed, while dirty dozen injection attacks fail with PERMISSION_DENIED.
