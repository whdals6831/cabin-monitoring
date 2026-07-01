---
name: git-commit
description: '한국어 Conventional Commits 메시지 분석, 지능형 스테이징, 메시지 생성을 포함해 git commit을 실행한다. 사용자가 변경사항 커밋, git commit 생성, 또는 "/commit"을 요청할 때 사용한다. 지원 기능: (1) 변경사항에서 type과 scope 자동 감지, (2) diff 기반 한국어 Conventional Commits 메시지 생성, (3) type/scope/description 선택적 재정의가 가능한 인터랙티브 커밋, (4) 논리적 그룹화를 위한 지능형 파일 스테이징'
---

# 한국어 Conventional Commits 기반 Git Commit

## 개요

Conventional Commits 명세를 사용해 표준화된 의미 있는 git commit을 생성한다. 실제 diff를 분석해 적절한 type, scope, message를 결정하되, 커밋 메시지의 description, body, footer 설명 문장은 한국어로 작성한다.

## Conventional Commit 형식

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## Commit Type

| Type       | 목적                             |
| ---------- | -------------------------------- |
| `feat`     | 새 기능                          |
| `fix`      | 버그 수정                        |
| `docs`     | 문서만 변경                      |
| `style`    | 포매팅/스타일 변경 (로직 없음)   |
| `refactor` | 코드 리팩터링 (기능/수정 없음)   |
| `perf`     | 성능 개선                        |
| `test`     | 테스트 추가/수정                 |
| `build`    | 빌드 시스템/의존성               |
| `ci`       | CI/설정 변경                     |
| `chore`    | 유지보수/기타                    |
| `revert`   | 커밋 되돌리기                    |

## Breaking Changes

```
# type/scope 뒤에 느낌표 사용
feat!: 사용 중단된 엔드포인트 제거

# BREAKING CHANGE footer 사용
feat: 설정에서 다른 설정 확장 허용

BREAKING CHANGE: `extends` 키 동작 변경
```

## 워크플로

### 1. Diff 분석

```bash
# 스테이징된 파일이 있으면 staged diff 사용
git diff --staged

# 스테이징된 파일이 없으면 working tree diff 사용
git diff

# 상태도 확인
git status --porcelain
```

### 2. 파일 스테이징 (필요한 경우)

스테이징된 항목이 없거나 변경사항을 다르게 그룹화하려는 경우:

```bash
# 특정 파일 스테이징
git add path/to/file1 path/to/file2

# 패턴으로 스테이징
git add *.test.*
git add src/components/*

# 인터랙티브 스테이징
git add -p
```

**절대 시크릿을 커밋하지 않는다** (.env, credentials.json, private keys).

### 3. 커밋 메시지 생성

diff를 분석해 다음을 결정한다:

- **Type**: 어떤 종류의 변경인가?
- **Scope**: 어떤 영역/모듈이 영향을 받는가?
- **Description**: 변경사항의 한 줄 한국어 요약 (현재 시제, 명령형, 72자 미만)
- **Body/Footer**: 필요한 경우 한국어로 작성하되, `BREAKING CHANGE`, `Closes`, `Refs` 같은 표준 토큰은 유지

### 4. 커밋 실행

```bash
# 한 줄 메시지
git commit -m "<type>[scope]: <description>"

# body/footer를 포함한 여러 줄 메시지
git commit -m "$(cat <<'EOF'
<type>[scope]: <description>

<optional body>

<optional footer>
EOF
)"
```

## 모범 사례

- 커밋 하나에는 논리적 변경 하나만 포함한다
- 커밋 메시지의 description, body, footer 설명 문장은 한국어로 작성한다
- type과 scope는 Conventional Commits 호환성을 위해 영문 소문자를 사용한다
- 현재 시제와 명령형에 맞는 간결한 한국어 서술을 사용한다
- 이슈 참조: `Closes #123`, `Refs #456`
- description은 72자 미만으로 유지한다

## Git 안전 프로토콜

- git config를 절대 수정하지 않는다
- 명시적 요청 없이 파괴적 명령을 절대 실행하지 않는다 (--force, hard reset)
- 사용자가 요청하지 않는 한 hook을 절대 건너뛰지 않는다 (--no-verify)
- main/master에 절대 force push하지 않는다
- hook 때문에 커밋이 실패하면 수정 후 새 커밋을 생성한다 (amend하지 않음)
