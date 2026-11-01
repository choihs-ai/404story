# 404호 소각로 데이터 규격 v1 (`window.GAME_DATA`)

제미나이가 시나리오를 넘길 때 따르는 규격이다. 엔진은 이 객체만 읽어 화면을 구동하고, 이야기 문장은 엔진 코드에 들어가지 않는다.
기획서 4장의 기본 규격(`chapters` → `dialogues`, `seizedMemories`)은 그대로 유지했고, 분기·수첩·엔딩을 위해 필드를 추가했다. 추가 필드는 모두 선택 사항이다.

## 1. 파일과 형식

- 대상 파일: `data/story-data.js` 하나. 내용 전체를 교체하면 된다.
- 형식: `window.GAME_DATA = { ... };` 형태의 **자바스크립트 객체**. JSON이 아니므로 주석(`//`)을 써도 된다. `window.STORY_DATA` 라는 이름도 인식한다.
- 문자열 안의 줄바꿈은 `\n`.
- 이미지 경로는 프로젝트 기준 상대경로. 권장 폴더:
  - 캐릭터 초상화 `assets/chars/이름_표정.png` (세로형, 배경 투명 PNG 권장)
  - 배경 `assets/bg/장면.jpg` (가로 16:9, 1600px 이상)
  - 압류품 삽화 `assets/mem/압류품id.jpg` (작게, 가로 800px 이하)
  - 이미지가 없거나 경로가 틀려도 게임은 돌아간다(기본 실루엣·기본 배경 사용). 경로 오류는 타이틀 화면 "데이터 점검"에 표시된다.

## 2. 최상위 구조

```js
window.GAME_DATA = {
  meta: { ... },        // 제목, 주인공, 규칙 수치, 매뉴얼 문구
  characters: { ... },  // 화자 이름 → 색, 초상화
  notebook: [ ... ],    // 개인 수첩 문장 (소각 시 █ 로 지워짐)
  chapters: [ ... ],    // 하루 단위 진행 (기획서 규격)
  endings: { ... }      // 엔딩 id → 엔딩 내용
};
```

## 3. `meta`

| 필드 | 필수 | 설명 |
| :- | :- | :- |
| `title` / `subtitle` | | 타이틀 화면 제목 |
| `protagonist` | | `{ id: "0404", name: "#0404", aliases: ["나"] }` 주인공 화자 이름. 이 이름들로 말하면 초상화 없이 주인공 대사로 표시 |
| `gameOverEnding` | 권장 | 감찰 의심도가 한도(기본 100)에 닿았을 때 갈 엔딩 id |
| `defaultEnding` | | `finale` 없이 마지막 챕터가 끝났을 때 갈 엔딩 id |
| `manual` | | 매뉴얼 "규정" 칸에 들어갈 문장 배열 (세계관 규정 문구) |
| `rules` | | 게임 수치. 아래 표 |

`meta.rules` 기본값:

| 필드 | 기본값 | 의미 |
| :- | :- | :- |
| `requireGrade` | `true` | 소각 전에 S~C 등급 도장을 찍어야 하는지 |
| `gradeTable` | S≥200, A≥120, B≥60, C≥0 | 열량 → 정답 등급. 매뉴얼에 표로 표시됨 |
| `hideSuspicion` | 15 | 은닉 1회당 의심도 |
| `wrongGradeSuspicion` | 5 | 등급 오판정 시 의심도 |
| `quotaMissSuspicion` | 20 | 하루 할당량 미달 시 의심도 |
| `maxSuspicion` | 100 | 이 값에 닿으면 `gameOverEnding` (0이면 게임오버 없음) |
| `baseLight` | 0.4 | 하루 시작 시 등대 밝기 (0~1). 소각할수록 밝아짐 |
| `hideDarken` | 0.05 | 은닉한 결정 1개당 화면이 영구히 어두워지는 정도 |
| `hintSelfMemories` | `true` | 주인공 관련 결정을 카드·판독기에서 미세하게 깜빡이게 할지 |

## 4. `characters`

```js
characters: {
  "감찰관": { color: "#c94a3a", portraits: { neutral: "assets/char/inspector_neutral.png", angry: "assets/char/inspector_angry.png" } },
  "이리나": { displayName: "이리나", color: "#9fb7d9", portraits: { neutral: "...", smile: "..." } }
}
```

- 키는 대사의 `speaker` 와 정확히 같아야 한다.
- `portraits` 의 키가 대사의 `expression` 값이다. 없는 표정이면 `default` → `neutral` 순으로 대체한다.
- `displayName` 은 이름표에 표시할 이름(생략하면 키 그대로). `[[mem_x|이름]]` 표기를 쓰면 기억 소각 뒤 이름표도 █ 로 가려진다.

## 5. `chapters[]` (하루)

| 필드 | 필수 | 설명 |
| :- | :- | :- |
| `id` | ✔ | `"ch1"` 처럼 고유 |
| `title` | ✔ | 날짜 카드·HUD에 표시 (`"제1일차: 정상 영업"`) |
| `date` | | 날짜 카드 위 작은 글씨, 달력에 표시 |
| `quota` | ✔ | 목표 열량. 0이면 할당량 없음 |
| `background` | | 그날 민원 창구 배경 이미지 |
| `bgmMood` | | 그날 시작 분위기 (아래 목록) |
| `dialogues` | | 출근 직후 대화 (기획서 규격) |
| `seizedMemories` | | 그날 처리할 압류품. 비어 있으면 업무 단계와 보고서를 건너뜀 |
| `events` | | 업무 도중 끼어드는 대화 (9장) |
| `outroDialogues` | | 업무 보고서 뒤 퇴근 대화 |
| `finale` | | 있으면 퇴근 대화 뒤 최후의 타이핑 단계로 들어가 엔딩으로 끝남 (12장) |
| `next` | | 다음 날 분기. 생략하면 배열 다음 챕터 (11장) |
| `skipReport` | | `true` 면 업무 보고서 화면 생략 |

하루 진행 순서: 날짜 카드 → `dialogues` → 업무(압류품 처리, `events`) → 업무 종료 버튼 → 업무 보고서 → `outroDialogues` → (`finale` 또는 다음 날).

## 6. 대사 한 줄 (`dialogues`, `outroDialogues`, `onBurn` 등 모든 대화 배열 공통)

```js
{ speaker: "감찰관", expression: "neutral", text: "404호, 오늘치 압류품이다.", bgmMood: "tense" }
```

| 필드 | 설명 |
| :- | :- |
| `speaker` | 화자. `""` 또는 생략이면 나레이션(이름표 없음, 기울임). 주인공 이름이면 초상화 없이 주인공 대사 |
| `expression` | 초상화 표정 키 |
| `text` | 대사. 7장의 표기법 사용 가능 |
| `bgmMood` | 이 줄부터 배경 앰비언트 변경 |
| `condition` | 조건이 참일 때만 이 줄을 보여줌 (14장) |
| `effect` | 화면 연출: `shake`, `glitch`, `flash`, `flicker`, `dark` |
| `sfx` | 효과음 (15장 목록) |
| `background` | 이 줄부터 배경 이미지 변경 (`"none"` 이면 기본 배경) |
| `portrait` | 이 줄만 특정 이미지 경로로 초상화 지정 |
| `hidePortrait` | `true` 면 초상화 내림 |
| `setFlags` / `clearFlags` | 플래그 켜기/끄기 (문자열 배열) |
| `effects` | `{ suspicion: 10, heat: 50, setFlags: [...] }` 수치 변화 |
| `choices` | 선택지 배열 (아래) |
| `label` / `goto` | 같은 대화 배열 안에서 점프. `goto: "end"` 는 대화 종료 |
| `end` | `true` 면 이 줄 뒤 대화 종료 |

선택지:

```js
{ speaker: "#0404", text: "(주인공 대사)",
  choices: [
    { text: "(선택지 A)", setFlags: ["choice_a"], goto: "after_a" },
    { text: "(선택지 B)", effects: { suspicion: 5 }, condition: "!burned:mem_202" }
  ] },
{ label: "after_a", speaker: "이리나", text: "(선택지 A를 고른 뒤 이어지는 대사)" }
```

## 7. 텍스트 표기법

| 표기 | 결과 |
| :- | :- |
| `[[mem_201\|이리나]]` | `mem_201` 을 **소각하면** 이 부분만 `███` 로 가려짐. 대사, 수첩, 이름표, 압류품 텍스트 어디서나 사용 |
| `[[burnedSelf>=2\|문장]]` | 키가 압류품 id가 아니면 조건식으로 보고, 조건이 참일 때 가려짐 |
| `{player}` | 주인공 이름 (`meta.protagonist.name`) |
| `{id}` | 주인공 사번 (`0404`) |
| `\n` | 줄바꿈 |

## 8. `seizedMemories[]` (압류된 기억 결정)

기획서 필드:

| 필드 | 필수 | 설명 |
| :- | :- | :- |
| `id` | ✔ | 전체 게임에서 고유 (`"mem_101"`). 조건식·수첩에서 이 id로 참조 |
| `owner` | ✔ | 채무자 표기 |
| `title` | ✔ | 기억 제목 (판독 후 공개) |
| `previewText` | ✔ | 판독기에 타이핑되는 회상 텍스트 |
| `calories` | ✔ | 열량. 소각 시 할당량에 더해짐. 등급 정답은 `gradeTable` 기준 |
| `isProtagonistMemory` | ✔ | `true` 면 소각 시 자기 기억 소실 연출(글리치, 먹먹한 소리, 수첩 █ 처리, 문서 훼손) |
| `burnConsequence` | | 소각 직후 판독기와 업무 보고서에 표시되는 결과 문장 |
| `hideConsequence` | | 은닉 직후·보고서에 표시되는 결과 문장 |

추가 필드 (선택):

| 필드 | 설명 |
| :- | :- |
| `ownerRedacted` | `true` 면 채무자 이름이 검게 칠해진 미등록 결정으로 표시 |
| `memo` | 판독기에 종이 쪽지처럼 붙는 손글씨 메모 (주인공 필체) |
| `image` | 판독기에 표시할 삽화 경로 |
| `grade` | 정답 등급을 직접 지정 (열량 표 대신) |
| `serial` | 카드에 찍히는 일련번호 (생략 시 `MEM-101`) |
| `condition` | 조건이 참일 때만 그날 트레이에 등장 |
| `suspicion` | 은닉 시 의심도를 이 값으로 (기본 `hideSuspicion`) |
| `burnEffects` / `hideEffects` | `{ setFlags: [...], suspicion: n, heat: n }` 처리 시 추가 효과 |
| `onBurn` / `onHide` | 처리 직후 재생할 대화 배열 (감찰관 반응 등) |
| `erasesNotebook` | 소각 시 통째로 지울 수첩 항목 id 배열 (수첩 쪽 `erasedBy` 와 같은 효과) |

## 9. `events[]` (업무 도중 대화)

```js
events: [
  { after: 2, dialogues: [ ... ] },                 // 그날 2번째 압류품 처리 직후
  { after: "mem_201", condition: "hidden:mem_201", dialogues: [ ... ] }, // 특정 압류품 처리 직후
  { after: "start", dialogues: [ ... ] },          // 업무 시작 직후
  { after: "end", dialogues: [ ... ] }             // 마지막 압류품 처리 직후
]
```

창구에 민원인(이리나 포함)이 찾아오는 장면을 여기에 넣는다. 각 이벤트는 한 번만 재생된다.

## 10. `notebook[]` (개인 수첩)

```js
notebook: [
  { id: "nb_01", day: 1, text: "(수첩 문장)", erasedBy: ["mem_202"] },
  { id: "nb_02", day: 2, text: "(문장 일부만 지워지는 예) [[mem_201|이리나]]", condition: "day>=2" },
  { id: "nb_03", day: 1, text: "(mem_101을 은닉하면 생기는 단서)", condition: "hidden:mem_101" }
]
```

| 필드 | 설명 |
| :- | :- |
| `text` | 손글씨로 표시. `[[id\|…]]` 로 일부만 지울 수 있음 |
| `day` | 왼쪽 여백에 찍히는 날짜 표기 |
| `condition` | 조건이 참이 되는 순간 수첩에 나타남 (은닉 단서 등). 새 항목이 생기면 수첩 아이콘에 알림 |
| `erasedBy` | 이 압류품 중 하나라도 소각하면 문장 전체가 `█` 로 바뀜. 소각 직후 수첩이 자동으로 열려 지워지는 장면을 보여줌 |

자기 기억(`isProtagonistMemory`)을 태울수록 매뉴얼·달력·HUD 사번 글자도 자동으로 깨진다(훼손도 = 태운 자기 기억 수 ÷ 전체 자기 기억 수). 따로 데이터를 넣을 필요는 없다.

## 11. `next` (다음 날 분기)

```js
next: "ch3"                                   // 고정 이동
next: "ending:ending_x"                        // 바로 엔딩
next: [                                        // 위에서부터 첫 번째로 조건이 맞는 것
  { condition: "hidden:mem_201 && suspicion<50", chapter: "ch3_secret" },
  { condition: "burnedSelf>=3", ending: "ending_x" },
  { chapter: "ch3" }                           // 조건 없음 = 기본값
]
```

## 12. `finale` (최후의 타이핑)

```js
finale: {
  prompt: "(입력 안내 문구)",
  placeholder: "압류 대상",
  bgmMood: "dread",
  answers: [
    { match: ["이리나"], ending: "ending_irina" },
    { match: ["0404", "#0404"], ending: "ending_self", condition: "hidden:mem_201" }
  ],
  mismatchText: "(틀린 이름을 넣었을 때 문구)",
  fallbackEnding: null
}
```

- 플레이어가 키보드로 직접 입력하고, 글자가 소각로로 빨려 들어간 뒤 엔딩으로 간다.
- 비교할 때 공백과 앞의 `#` 은 무시하고, 영문은 대소문자를 구분하지 않는다.
- `answers[].condition` 으로 특정 조건에서만 받아들이는 답을 만들 수 있다.
- 맞는 답이 없으면 `mismatchText` 를 보여주고 다시 입력받는다. `fallbackEnding` 을 지정하면 다시 묻지 않고 그 엔딩으로 간다.

## 13. `endings`

```js
endings: {
  ending_irina: { title: "(엔딩 제목)", dialogues: [ ... ], epilogue: "(에필로그)", bgmMood: "sad", background: "assets/bg/end_a.jpg" },
  ending_self: [                                   // 배열이면 조건 분기 (위에서부터 첫 번째)
    { condition: "burnedSelf>=2", title: "(엔딩 제목)", epilogue: "(에필로그)" },
    { title: "(엔딩 제목)", epilogue: "(에필로그)" }   // 조건 없는 마지막 항목 = 기본
  ]
}
```

엔딩은 `dialogues`(민원 창구 장면) → 엔딩 화면(`title`, 한 글자씩 나오는 `epilogue`, 통계) 순서로 재생된다.

## 14. 조건식

문자열 하나, 또는 배열(모두 참이어야 함).

| 식 | 참이 되는 경우 |
| :- | :- |
| `burned:mem_101` | 그 압류품을 소각함 |
| `hidden:mem_101` | 은닉함 |
| `processed:mem_101` | 소각이든 은닉이든 처리함 |
| `flag:choice_a` | 플래그가 켜져 있음 |
| `quotaMet:ch1` / `quotaMissed:ch1` | 그날 할당량 달성 / 미달 |
| `chapter:ch2` | 현재 챕터가 ch2 |
| `suspicion>=50` | 감찰 의심도 |
| `burnedSelf>=2` | 태운 자기 기억 수 |
| `burnedCount>=5` / `hiddenCount>=1` | 전체 소각 / 은닉 수 |
| `heat>=300` / `totalHeat>=900` | 오늘 / 누적 열량 |
| `day>=2` | 날짜 (1일차 = 1) |

- 비교 연산자: `>=`, `<=`, `>`, `<`, `==`, `!=`
- `!` 부정: `"!burned:mem_202"`
- `&&` 그리고, `||` 또는: `"hidden:mem_201 && suspicion<50 || flag:x"` (`||` 가 먼저 나뉨, 괄호 없음)
- 복잡하면 객체: `{ any: ["burned:mem_1", { all: ["hidden:mem_2", "day>=3"] }] }`, `{ not: "flag:x" }`

"NPC가 주인공을 못 알아보는" 연출은 같은 자리에 대사 두 줄을 두고 `condition: "!burned:mem_202"` / `condition: "burned:mem_202"` 로 나누면 된다.

## 15. 사용할 수 있는 값

- `bgmMood`: `office`(형광등 사무실), `calm`, `tense`, `dread`, `warm`, `sad`, `mystery`, `truth`, `climax`, `silence`
- `sfx`: `type`, `typewriter`, `bell`, `stamp`, `insert`, `beep`, `click`, `deny`, `paper`, `drawer`, `burn`, `glitch`, `scribble`, `knock`, `chime`, `whoosh`, `heartbeat`
- `effect`: `shake`, `glitch`, `flash`, `flicker`, `dark`

모든 소리는 Web Audio API로 실시간 합성되므로 오디오 파일이 필요 없다.

## 16. 제미나이 v1 형식 호환 (엔진이 자동 변환)

제미나이 시나리오 v1 은 아래 형식으로 들어왔고, 엔진의 `adaptData` 가 그대로 읽는다. 다음 버전도 이 형식을 써도 된다.

| 제미나이 형식 | 엔진이 해석하는 방식 |
| :- | :- |
| `meta.protagonistId: "0404"` | 주인공 사번. 이름표·HUD는 `#0404` |
| `assets.portraits.{그룹}.{표정}` | 대사 줄의 `portrait` 경로가 속한 그룹을 그 화자의 초상화 세트로 연결 |
| 대사 줄 `portrait: null` | 초상화를 내림 |
| 화자 `"시스템"` | 초상화 없이 단말기 글씨(호박색 고정폭)로 표시 |
| `notebook[].title` | 수첩 항목 제목(붉은 밑줄) |
| `notebook[].linkedMemoryId` | 그 압류품이 나오는 날부터 수첩에 보임 (`condition` 이 없을 때) |
| `notebook[].redactKeyword`, `seizedMemories[].redactKeyword` | 그 압류품을 소각하면 수첩 전체에서 그 단어만 `█` 로 지워짐 |
| `seizedMemories[].grade` (모든 압류품에 있을 때) | 판독기가 등급을 자동 판정해 도장을 찍음. 등급 버튼은 숨김. `SSR` 같은 등급도 가능 |
| `endings.inputPrompt` + 각 엔딩의 `triggerKeywords` | 마지막 챕터 뒤 최후의 타이핑 단계. 입력한 단어가 `triggerKeywords` 와 맞는 엔딩으로 감 |
| `triggerKeywords: []` 인 엔딩 | 타이핑으로는 갈 수 없음. `meta.gameOverEnding` 으로 지정해 감찰 적발 엔딩으로 사용 |

함께 추가된 필드:

- `seizedMemories[].erasesNotebook: "all"` 소각 시 수첩 전체를 `█` 로 지움
- `burnEffects` / `hideEffects` / 대사 `effects` 의 `muffle: 0.15` 배경음을 그만큼 영구히 더 먹먹하게 함 (0~1 누적)
- `bgmMood` 에 `mystery`, `truth`, `climax` 추가 (별칭 `melancholy` = `sad`, `work` = `office`)

## 17. 넘기기 전 점검

1. `data/story-data.js` 를 교체하고 `index.html` 을 브라우저로 연다.
2. 타이틀 화면에 "데이터 점검: 확인할 항목 N건" 이 보이면 눌러서 오타(없는 id, 해석 안 되는 조건식, 없는 엔딩 등)를 고친다.
3. 주소 끝에 `#debug` 를 붙이면 챕터 바로가기·의심도 조절 패널이 나온다.
