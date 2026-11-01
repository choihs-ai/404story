/* ==========================================================================
   404호 소각로 — 스토리 데이터 (제미나이 담당 파일)

   ※ 지금 들어 있는 내용은 엔진 시험용 더미 데이터다.
     "[더미]"로 시작하는 문장은 모두 제미나이가 실제 시나리오로 교체할 자리다.
     기획서에 이미 있던 대사(ch1 감찰관 첫 대사, mem_101)만 원문 그대로 넣었다.

   규격 문서: docs/DATA_SCHEMA.md
   이 파일은 일반 <script>로 로드되므로 file:// 에서도 동작한다. (JSON이 아니라 JS 객체)
   ========================================================================== */
window.GAME_DATA = {
  meta: {
    title: "404호 소각로",
    subtitle: "Incinerator No. 404",
    protagonist: { id: "0404", name: "#0404" },
    gameOverEnding: "ending_arrested",
    rules: {
      requireGrade: true,
      gradeTable: [
        { grade: "S", min: 200 },
        { grade: "A", min: 120 },
        { grade: "B", min: 60 },
        { grade: "C", min: 0 }
      ],
      hideSuspicion: 15,
      wrongGradeSuspicion: 5,
      quotaMissSuspicion: 20,
      maxSuspicion: 100
    },
    manual: [
      "[더미] 소각과 업무 규정 1조 자리",
      "[더미] 소각과 업무 규정 2조 자리",
      "[더미] 소각과 업무 규정 3조 자리"
    ]
  },

  characters: {
    "감찰관": { color: "#c94a3a", portraits: {} },
    "이리나": { color: "#9fb7d9", portraits: {} },
    "민원인": { color: "#8a8170", portraits: {} }
  },

  notebook: [
    { id: "nb_01", day: 1, text: "[더미] 수첩 첫 장 — 주인공의 평범한 일상 메모 자리.", erasedBy: ["mem_202"] },
    { id: "nb_02", day: 2, text: "[더미] 잊으면 안 되는 이름: [[mem_201|이리나]]. (mem_201을 태우면 이름만 지워짐)", condition: "day>=2" },
    { id: "nb_03", day: 1, text: "[더미] mem_101을 은닉했을 때만 생기는 단서 메모 자리.", condition: "hidden:mem_101" },
    { id: "nb_04", day: 2, text: "[더미] 주인공 필체로 남긴 메모 자리. (mem_201을 태우면 통째로 지워짐)", condition: "day>=2", erasedBy: ["mem_201"] }
  ],

  chapters: [
    {
      id: "ch1",
      title: "제1일차: 정상 영업",
      date: "[더미] 날짜 표기",
      quota: 300,
      dialogues: [
        { speaker: "감찰관", expression: "neutral", text: "404호, 오늘치 압류품이다. 사사로운 감정은 섞지 마라.", bgmMood: "tense" },
        { speaker: "", text: "[더미] 나레이션 자리 — 업무 시작 전 사무실 묘사.", bgmMood: "office" }
      ],
      seizedMemories: [
        {
          id: "mem_101",
          owner: "시민 #8821 (연체자)",
          title: "아이의 첫 걸음마",
          previewText: "좁은 단칸방, 비틀거리며 내 손을 잡던 작은 손가락의 온기...",
          calories: 150,
          isProtagonistMemory: false,
          burnConsequence: "시민 #8821이 내일 창구에 찾아와 왜 자신이 아기 신발을 들고 있는지 묻는다.",
          hideConsequence: "할당량 150 부족. 수첩에 단서 기록됨."
        },
        {
          id: "mem_102",
          owner: "[더미] 시민 #0000 (연체자)",
          title: "[더미] 일반 시민 기억 B",
          previewText: "[더미] 회상 텍스트 자리.",
          calories: 120,
          isProtagonistMemory: false,
          burnConsequence: "[더미] 소각 결과 자리.",
          hideConsequence: "[더미] 은닉 결과 자리."
        },
        {
          id: "mem_103",
          owner: "[더미] 시민 #0001 (체납자)",
          title: "[더미] 일반 시민 기억 C",
          previewText: "[더미] 회상 텍스트 자리.",
          calories: 90,
          isProtagonistMemory: false,
          burnConsequence: "[더미] 소각 결과 자리.",
          hideConsequence: "[더미] 은닉 결과 자리.",
          onHide: [
            { speaker: "감찰관", expression: "suspicious", text: "[더미] 은닉 직후 감찰관 반응 대사 자리.", effect: "shake" }
          ]
        }
      ],
      events: [
        {
          after: 2,
          dialogues: [
            { speaker: "민원인", expression: "neutral", text: "[더미] 업무 도중 창구에 찾아온 민원인 대사 자리.", sfx: "chime" },
            {
              speaker: "#0404", text: "[더미] 주인공 대답 선택지 자리.",
              choices: [
                { text: "[더미] 선택지 A (flag: helped_visitor)", setFlags: ["helped_visitor"] },
                { text: "[더미] 선택지 B (의심도 +5)", effects: { suspicion: 5 } }
              ]
            }
          ]
        }
      ],
      outroDialogues: [
        { speaker: "감찰관", expression: "neutral", text: "[더미] 할당량 달성 시 퇴근 대사 자리.", condition: "quotaMet:ch1" },
        { speaker: "감찰관", expression: "angry", text: "[더미] 할당량 미달 시 퇴근 대사 자리.", condition: "!quotaMet:ch1", effect: "shake" }
      ]
    },

    {
      id: "ch2",
      title: "[더미] 제2일차 제목",
      date: "[더미] 날짜 표기",
      quota: 350,
      dialogues: [
        { speaker: "", text: "[더미] 2일차 출근 나레이션 자리.", bgmMood: "office" },
        { speaker: "민원인", expression: "confused", text: "[더미] mem_101을 태웠을 때만 나오는 시민 #8821 재방문 대사 자리.", condition: "burned:mem_101" }
      ],
      seizedMemories: [
        {
          id: "mem_201",
          owner: "██████",
          ownerRedacted: true,
          title: "[더미] 미등록 기억 결정",
          previewText: "[더미] 이리나의 모습이 담긴 회상 자리.",
          memo: "[더미] 주인공 자신의 필체로 적힌 메모 자리.",
          calories: 220,
          isProtagonistMemory: true,
          burnConsequence: "[더미] 미등록 결정 소각 결과 자리.",
          hideConsequence: "[더미] 미등록 결정 은닉 결과 자리.",
          suspicion: 25
        },
        {
          id: "mem_202",
          owner: "[더미] 압류 대상자 표기",
          title: "[더미] 주인공 관련 기억",
          previewText: "[더미] 주인공의 과거 회상 자리.",
          calories: 140,
          isProtagonistMemory: true,
          burnConsequence: "[더미] 이후 이리나가 주인공을 알아보지 못하게 되는 결과 자리.",
          hideConsequence: "[더미] 은닉 결과 자리."
        },
        {
          id: "mem_203",
          owner: "[더미] 시민 #0002 (연체자)",
          title: "[더미] 일반 시민 기억 D",
          previewText: "[더미] 회상 텍스트 자리.",
          calories: 100,
          isProtagonistMemory: false,
          burnConsequence: "[더미] 소각 결과 자리.",
          hideConsequence: "[더미] 은닉 결과 자리."
        },
        {
          id: "mem_204",
          condition: "hidden:mem_101",
          owner: "[더미] 시민 #8821 (연체자)",
          title: "[더미] 조건부 압류품 (mem_101 은닉 시에만 등장)",
          previewText: "[더미] 회상 텍스트 자리.",
          calories: 80,
          isProtagonistMemory: false,
          burnConsequence: "[더미] 소각 결과 자리.",
          hideConsequence: "[더미] 은닉 결과 자리."
        }
      ],
      events: [
        {
          after: "mem_201",
          dialogues: [
            { speaker: "이리나", expression: "neutral", text: "[더미] 이리나 첫 등장 대사 자리.", bgmMood: "sad", sfx: "knock" },
            { speaker: "이리나", expression: "neutral", text: "[더미] 이리나가 주인공을 알아보는 대사 자리.", condition: "!burned:mem_202" },
            { speaker: "이리나", expression: "blank", text: "[더미] 이리나가 주인공을 알아보지 못하는 대사 자리.", condition: "burned:mem_202", effect: "glitch" }
          ]
        }
      ],
      outroDialogues: [
        { speaker: "", text: "[더미] 2일차 퇴근 나레이션 자리. 자기 기억을 태운 개수: 조건 burnedSelf>=1 로 분기 가능.", condition: "burnedSelf>=1" },
        { speaker: "", text: "[더미] 자기 기억을 하나도 태우지 않은 경우의 퇴근 나레이션 자리.", condition: "burnedSelf==0" }
      ]
    },

    {
      id: "ch3",
      title: "[더미] 최종일 제목",
      date: "[더미] 날짜 표기",
      quota: 0,
      dialogues: [
        { speaker: "감찰관", expression: "neutral", text: "[더미] 최종 소각 지시 대사 자리.", bgmMood: "dread" },
        { speaker: "이리나", expression: "neutral", text: "[더미] 마지막 순간 이리나 대사 자리.", condition: "!burned:mem_201" }
      ],
      seizedMemories: [],
      finale: {
        prompt: "[더미] 최종 투입 안내 문구 자리.\n(테스트: 이리나 또는 0404 입력)",
        placeholder: "압류 대상",
        answers: [
          { match: ["이리나"], ending: "ending_irina" },
          { match: ["0404", "#0404"], ending: "ending_self" }
        ],
        mismatchText: "[더미] 등록되지 않은 대상일 때 안내 문구 자리."
      }
    }
  ],

  endings: {
    ending_irina: {
      title: "[더미] 엔딩 A 제목",
      dialogues: [
        { speaker: "", text: "[더미] 이리나를 소각했을 때 마지막 장면 대사 자리.", bgmMood: "sad" }
      ],
      epilogue: "[더미] 엔딩 A 에필로그 본문 자리."
    },
    ending_self: [
      {
        condition: "burnedSelf>=2",
        title: "[더미] 엔딩 B-1 제목 (자기 기억 2개 이상 소각)",
        epilogue: "[더미] 엔딩 B-1 에필로그 자리."
      },
      {
        title: "[더미] 엔딩 B-2 제목",
        dialogues: [
          { speaker: "이리나", expression: "neutral", text: "[더미] 사번 0404를 소각했을 때 이리나 대사 자리.", bgmMood: "warm" }
        ],
        epilogue: "[더미] 엔딩 B-2 에필로그 자리."
      }
    ],
    ending_arrested: {
      title: "[더미] 감찰 적발 엔딩 제목",
      dialogues: [
        { speaker: "감찰관", expression: "angry", text: "[더미] 의심도 100 도달 시 체포 대사 자리.", bgmMood: "dread", effect: "shake" }
      ],
      epilogue: "[더미] 감찰 적발 엔딩 에필로그 자리."
    }
  }
};
