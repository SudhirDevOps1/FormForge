## Summary

<!-- What does this PR do? Why is it needed? -->

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Security fix or hardening
- [ ] Dependency update
- [ ] Documentation / chore

## Checklist

### Code Quality
- [ ] TypeScript typecheck passes (`npm run typecheck`)
- [ ] ESLint passes with zero warnings (`npm run lint`)
- [ ] Security test suite passes (`npm run test:security`)

### Security Impact
- [ ] I have assessed the security impact of this change
- [ ] No secrets, credentials, or PII are introduced in source files
- [ ] Changes to authentication, crypto, or session logic have been reviewed for correctness
- [ ] New API endpoints have rate limiting and input validation
- [ ] SSRF-susceptible URLs (webhooks, redirects) go through `src/lib/url-validation.ts`

### Database (if applicable)
- [ ] Drizzle migration generated (`npm run db:generate`)
- [ ] Migration SQL reviewed for correctness
- [ ] No data loss in the migration path

### Documentation
- [ ] `docs/CHANGELOG.md` updated with a note under `[Unreleased]`
- [ ] README updated if new configuration or behavior is introduced

## Related Issues

Closes #<!-- issue number -->
