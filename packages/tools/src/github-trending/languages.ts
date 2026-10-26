export interface TrendingLanguage {
  name: string
  title: string
}


export const TRENDING_LANGUAGES: TrendingLanguage[] = [
  { name: '', title: '所有语言' },
  { name: 'c%23', title: 'C#' },
  { name: 'c++', title: 'C++' },
  { name: 'css', title: 'CSS' },
  { name: 'dart', title: 'Dart' },
  { name: 'go', title: 'Go' },
  { name: 'html', title: 'HTML' },
  { name: 'java', title: 'Java' },
  { name: 'javascript', title: 'JavaScript' },
  { name: 'kotlin', title: 'Kotlin' },
  { name: 'objective-c', title: 'Objective-C' },
  { name: 'php', title: 'PHP' },
  { name: 'python', title: 'Python' },
  { name: 'r', title: 'R' },
  { name: 'ruby', title: 'Ruby' },
  { name: 'swift', title: 'Swift' },
]

export const TRENDING_SINCE = ['monthly', 'weekly', 'daily'] as const
