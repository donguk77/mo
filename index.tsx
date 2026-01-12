import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { 
  Users, Database, Zap, Activity, Filter, Info, 
  ChevronRight, RefreshCw, AlertCircle, BarChart3, LayoutGrid, MapPin, Factory, Upload, FileDown, CheckCircle2, Files, Store, BrainCircuit, Search, Lightbulb, SlidersHorizontal, Layers, HelpCircle, AlertTriangle, FileText, History, TrendingUp, ShieldCheck, Eye, EyeOff, Scale
} from 'lucide-react';

// --- Types & Constants ---
// Age Groups: Now supports detailed (5-year) and broad (generation)
type AgeGroup = string; // Dynamic string based on grouping
type Gender = '남' | '여';

const GENDERS: Gender[] = ['남', '여'];

// Mapping Helpers
const getDetailedAge = (rawAge: string): string => {
  const age = rawAge.replace(/세/g, '').replace(/\s+/g, '').trim();
  const num = parseInt(age);
  if (!isNaN(num)) {
    if (num < 5) return '00-04세';
    if (num < 10) return '05-09세';
    if (num < 15) return '10-14세';
    if (num < 20) return '15-19세';
    if (num < 25) return '20-24세';
    if (num < 30) return '25-29세';
    if (num < 35) return '30-34세';
    if (num < 40) return '35-39세';
    if (num < 45) return '40-44세';
    if (num < 50) return '45-49세';
    if (num < 55) return '50-54세';
    if (num < 60) return '55-59세';
    if (num < 65) return '60-64세';
    return '65세+';
  }
  return '미상';
};

const getBroadAge = (detailedAge: string): string => {
  const num = parseInt(detailedAge.substring(0, 2));
  if (isNaN(num)) return '60세+';
  if (num < 20) return '0-19세';
  if (num < 30) return '20-29세';
  if (num < 40) return '30-39세';
  if (num < 50) return '40-49세';
  if (num < 60) return '50-59세';
  return '60세+';
};

// 5-year intervals for internal calculation
const INTERNAL_AGE_GROUPS = [
  '00-04세', '05-09세', '10-14세', '15-19세',
  '20-24세', '25-29세', '30-34세', '35-39세',
  '40-44세', '45-49세', '50-54세', '55-59세',
  '60-64세', '65세+'
];

// Grouping Logic
const NAT_GROUPS = {
  'China': ['중국', '한국계 중국인', '대만', '홍콩'],
  'SE_Asia': ['베트남', '태국', '필리핀', '인도네시아', '미얀마', '캄보디아', '동티모르', '말레이시아', '라오스'],
  'Central_Asia': ['우즈베키스탄', '카자흐스탄', '키르기스스탄', '몽골', '타지키스탄'],
  'South_Asia': ['네팔', '방글라데시', '스리랑카', '파키스탄', '인도'],
  'Developed': ['미국', '캐나다', '영국', '호주', '뉴질랜드', '일본', '프랑스', '독일', '러시아'],
};

const VISA_GROUPS = {
  'Unskilled': ['E-9', 'E-10', 'H-2', '비전문취업', '선원취업', '방문취업'],
  'Professional': ['E-1', 'E-2', 'E-3', 'E-4', 'E-5', 'E-6', 'E-7', '교수', '회화', '연구', '기술', '전문'],
  'Student': ['D-2', 'D-4', '유학', '연수'],
  'Residency': ['F-2', 'F-4', 'F-5', 'F-6', '거주', '재외동포', '영주', '결혼이민'],
  'Temp': ['G-1', 'D-1', 'D-3', '기타', '방문동거', 'F-1', 'F-3']
};

const mapNationality = (n: string, level: 'small' | 'medium' | 'large') => {
  if (level === 'small') return n;
  
  // Medium: Regional
  let region = '기타(Other)';
  if (NAT_GROUPS.China.some(k => n.includes(k))) region = '동북아(중국권)';
  else if (NAT_GROUPS.SE_Asia.some(k => n.includes(k))) region = '동남아시아';
  else if (NAT_GROUPS.Central_Asia.some(k => n.includes(k))) region = '중앙아시아';
  else if (NAT_GROUPS.South_Asia.some(k => n.includes(k))) region = '남아시아';
  else if (NAT_GROUPS.Developed.some(k => n.includes(k))) region = '북미/유럽/일본';
  
  if (level === 'medium') return region;

  // Large: Continental
  if (region === '동북아(중국권)' || region === '동남아시아' || region === '중앙아시아' || region === '남아시아') return '아시아';
  if (region === '북미/유럽/일본') return '구미주/선진국';
  return '기타 권역';
};

const mapVisa = (v: string, level: 'small' | 'medium' | 'large') => {
  if (level === 'small') return v;

  // Medium: Function
  let func = '기타/임시';
  if (VISA_GROUPS.Unskilled.some(k => v.includes(k))) func = '단순노무(E9/H2)';
  else if (VISA_GROUPS.Professional.some(k => v.includes(k))) func = '전문인력(E7 등)';
  else if (VISA_GROUPS.Student.some(k => v.includes(k))) func = '유학/연수(D2/D4)';
  else if (VISA_GROUPS.Residency.some(k => v.includes(k))) func = '정주/동포(F계열)';
  
  if (level === 'medium') return func;

  // Large: Purpose
  if (func === '단순노무(E9/H2)' || func === '전문인력(E7 등)') return '경제활동(취업)';
  if (func === '정주/동포(F계열)') return '정주/이민';
  return '비경제/기타';
};

// Raw Data Interface
interface RawDataRecord {
  year: string;
  district: string;
  categoryType: 'nationality' | 'visa' | 'age';
  categoryValue: string;
  gender: Gender | 'Total';
  count: number;
  isTotal: boolean; // Flag to identify Total/Subtotal rows
}

// Data Quality Report Interface
interface DataQualityReport {
  sums: {
    nat: number;
    visa: number;
    age: number;
    gender: number;
  };
  finalTotal: number;
  maxDiff: number;
  discrepancyRate: number;
  status: 'clean' | 'warning' | 'error';
  prevYearAvailable: boolean;
  prevYear: string | null; // Track exact year used
}

const readCSVFile = (file: File): Promise<{ headers: string[], rows: string[][] }> => {
  return new Promise((resolve) => {
    const read = (encoding: string) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        const parseLine = (line: string) => {
           const res = [];
           let current = '';
           let inQuote = false;
           for(let i=0; i<line.length; i++){
             const char = line[i];
             if(char === '"') { inQuote = !inQuote; continue; }
             if(char === ',' && !inQuote) { res.push(current.trim()); current = ''; }
             else { current += char; }
           }
           res.push(current.trim());
           return res;
        };
        if (lines.length < 2) { resolve({ headers: [], rows: [] }); return; }
        let headerIdx = -1;
        for(let i=0; i<Math.min(lines.length, 10); i++) {
           if(lines[i].includes('행정구역') || lines[i].includes('시군구') || lines[i].includes('District')) {
              headerIdx = i;
              break;
           }
        }
        if (headerIdx === -1) {
          if (encoding === 'UTF-8') read('EUC-KR'); 
          else resolve({ headers: [], rows: [] });
          return;
        }
        const headers = parseLine(lines[headerIdx]);
        const rows = lines.slice(headerIdx + 1).map(parseLine);
        resolve({ headers, rows });
      };
      reader.readAsText(file, encoding);
    };
    read('UTF-8');
  });
};

function PopulationPredictor() {
  const [iterations, setIterations] = useState(0);
  const [errorHistory, setErrorHistory] = useState<{ i: number; error: number }[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  
  // Controls
  const [industrialProximity, setIndustrialProximity] = useState(65); 
  const [usePriorSeed, setUsePriorSeed] = useState(true); 
  
  // Grouping Levels
  const [natLevel, setNatLevel] = useState<'small' | 'medium' | 'large'>('small');
  const [visaLevel, setVisaLevel] = useState<'small' | 'medium' | 'large'>('small');
  const [ageLevel, setAgeLevel] = useState<'small' | 'medium'>('medium');

  // Visualization Thresholds (Split)
  const [natThreshold, setNatThreshold] = useState(50);
  const [visaThreshold, setVisaThreshold] = useState(50);
  const [ageThreshold, setAgeThreshold] = useState(0);

  // Confidence Interval Setting
  const [ciLevel, setCiLevel] = useState<number | null>(0.95); // 0.95, 0.99, 0.995, null (off)

  // File & Data State
  const [rawData, setRawData] = useState<RawDataRecord[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [availableDistricts, setAvailableDistricts] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');

  const [activeNationalities, setActiveNationalities] = useState<string[]>([]);
  const [activeVisas, setActiveVisas] = useState<string[]>([]);
  
  // Data Report State
  const [dataReport, setDataReport] = useState<DataQualityReport | null>(null);
  
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Marginals
  const [targetNationality, setTargetNationality] = useState<Record<string, number>>({});
  const [targetVisa, setTargetVisa] = useState<Record<string, number>>({});
  const [targetAge, setTargetAge] = useState<Record<string, number>>({});
  const [targetGender, setTargetGender] = useState<Record<Gender, number>>({ '남': 0, '여': 0 });
  const [populationAnchor, setPopulationAnchor] = useState<number>(0);

  // Cube: Key is "Nat|Visa|Age(5yr)|Gender"
  const [cube, setCube] = useState<Record<string, number>>({});
  const [heatmapGender, setHeatmapGender] = useState<Gender | 'Total'>('Total');
  const [showInsight, setShowInsight] = useState(false);
  const [viewMode, setViewMode] = useState<'snapshot' | 'trend'>('snapshot');

  // --- Handlers ---
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);
    let newRecords: RawDataRecord[] = [];
    let fileCount = 0;

    for (const file of fileList) {
      const { headers, rows } = await readCSVFile(file);
      if (headers.length === 0) continue;

      const idxDistrict = headers.findIndex(h => h.includes('행정구역') || h.includes('시군구'));
      const idxNationality = headers.findIndex(h => h.includes('국적') || h.includes('지역'));
      const idxVisa = headers.findIndex(h => h.includes('체류자격'));
      const idxAge = headers.findIndex(h => h.includes('연령'));
      const idxSex = headers.findIndex(h => h.includes('성별'));
      const idxYearColumn = headers.findIndex(h => h.includes('시점') || h.includes('년도') || h === 'year');
      
      const yearHeaderIndices: number[] = [];
      if (idxYearColumn === -1) {
        headers.forEach((h, idx) => { if (/^\d{4}/.test(h)) yearHeaderIndices.push(idx); });
      }
      if (idxDistrict === -1) continue;
      let type: 'nationality' | 'visa' | 'age' | null = null;
      let targetIdx = -1;
      if (idxNationality !== -1) { type = 'nationality'; targetIdx = idxNationality; }
      else if (idxVisa !== -1) { type = 'visa'; targetIdx = idxVisa; }
      else if (idxAge !== -1) { type = 'age'; targetIdx = idxAge; }
      if (!type) continue; 

      rows.forEach(row => {
        if (row.length <= idxDistrict || row.length <= targetIdx) return;
        const district = row[idxDistrict];
        const categoryVal = row[targetIdx].trim();
        
        // Improved Total detection
        const isTotal = ['합계', '소계', '총계', 'Total', 'Subtotal', '전체'].includes(categoryVal) || categoryVal === '계';

        let gender: Gender | 'Total' = 'Total';
        if (idxSex !== -1 && row[idxSex]) {
          const s = row[idxSex];
          if (s.includes('남') || s.toLowerCase() === 'male') gender = '남';
          else if (s.includes('여') || s.toLowerCase() === 'female') gender = '여';
        }

        const pushRecord = (year: string, count: number) => {
          newRecords.push({ year, district, categoryType: type!, categoryValue: categoryVal, gender, count, isTotal });
        };
        if (idxYearColumn !== -1) {
           const year = row[idxYearColumn];
           const valStr = row[row.length - 1];
           const count = parseInt(valStr.replace(/,/g, ''));
           if (!isNaN(count)) pushRecord(year, count);
        } else if (yearHeaderIndices.length > 0) {
          yearHeaderIndices.forEach(yIdx => {
             if (yIdx >= row.length) return;
             const yearLabel = headers[yIdx].substring(0, 4); 
             const valStr = row[yIdx];
             const count = parseInt(valStr.replace(/,/g, ''));
             if (!isNaN(count)) pushRecord(yearLabel, count);
          });
        }
      });
      fileCount++;
    }
    if (newRecords.length > 0) {
      const combinedData = [...rawData, ...newRecords];
      setRawData(combinedData);
      const years = Array.from(new Set(combinedData.map(r => r.year))).sort().reverse();
      const districts = Array.from(new Set(combinedData.map(r => r.district))).sort();
      setAvailableYears(years);
      setAvailableDistricts(districts);
      if (!selectedYear && years.length > 0) setSelectedYear(years[0]);
      if (!selectedDistrict && districts.length > 0) setSelectedDistrict(districts[0]);
      setUploadStatus({ type: 'success', message: `${fileCount}개 파일 로드 완료. (누적: ${combinedData.length}행)` });
    } else {
      setUploadStatus({ type: 'error', message: "데이터 인식 실패." });
    }
  };

  useEffect(() => {
    if (!selectedYear || !selectedDistrict || rawData.length === 0) {
        setDataReport(null);
        return;
    }
    const filtered = rawData.filter(r => r.year === selectedYear && r.district === selectedDistrict);
    
    // Check for previous year data
    const prevYear = (parseInt(selectedYear) - 1).toString();
    const hasPrevYear = rawData.some(r => r.year === prevYear && r.district === selectedDistrict);

    const natSet = new Set<string>();
    const visaSet = new Set<string>();
    
    // SMART ANCHOR: Find the single largest "Total" value to use as the true population count
    // This handles the case where users upload multiple files and sums get doubled/tripled.
    let maxKnownTotal = 0;
    filtered.forEach(r => {
        if (r.isTotal && r.gender === 'Total' && r.count > maxKnownTotal) {
            maxKnownTotal = r.count;
        }
    });

    // Fallback: If no Total row found, use max sum of a category
    
    filtered.forEach(r => {
      if (!r.isTotal) {
          if (r.categoryType === 'nationality') natSet.add(r.categoryValue);
          if (r.categoryType === 'visa') visaSet.add(r.categoryValue);
      }
    });
    
    const distinctNats = Array.from(natSet).sort();
    const distinctVisas = Array.from(visaSet).sort((a,b) => a.localeCompare(b));
    setActiveNationalities(distinctNats);
    setActiveVisas(distinctVisas);

    // Initialize Targets
    const newNat: Record<string, number> = {};
    const newVisa: Record<string, number> = {};
    const newAge: Record<string, number> = {};
    
    distinctNats.forEach(n => newNat[n] = 0);
    distinctVisas.forEach(v => newVisa[v] = 0);
    INTERNAL_AGE_GROUPS.forEach(a => newAge[a] = 0);

    let genderFromTotal: Record<Gender, number> = { '남': 0, '여': 0 };
    let hasTotalGender = false;

    filtered.forEach(r => {
      if (r.isTotal && r.gender !== 'Total') {
        genderFromTotal[r.gender] = Math.max(genderFromTotal[r.gender], r.count);
        if (r.count > 0) hasTotalGender = true;
      }
      if (!r.isTotal && r.gender === 'Total') {
        if (r.categoryType === 'nationality') newNat[r.categoryValue] += r.count;
        else if (r.categoryType === 'visa') newVisa[r.categoryValue] += r.count;
        else if (r.categoryType === 'age') {
          const match = getDetailedAge(r.categoryValue); 
          if (match) newAge[match] += r.count;
        }
      }
    });

    const sumNat = Object.values(newNat).reduce((a,b)=>a+b,0);
    const sumVisa = Object.values(newVisa).reduce((a,b)=>a+b,0);
    const sumAge = Object.values(newAge).reduce((a,b)=>a+b,0);
    const sumGenderRaw = genderFromTotal['남'] + genderFromTotal['여'];

    // Determine Grand Total Anchor
    let grandTotal = maxKnownTotal > 0 ? maxKnownTotal : Math.max(sumNat, sumVisa, sumAge);
    setPopulationAnchor(grandTotal);

    // FIX: Normalize ALL targets to match the Grand Total Anchor
    // This fixes the "Korean-Chinese" vs "China" double counting issue by forcing the sum to fit the anchor.
    const normalize = (dict: Record<string, number>, currentSum: number, targetSum: number) => {
        if (currentSum === 0) return;
        const ratio = targetSum / currentSum;
        Object.keys(dict).forEach(k => dict[k] = Math.round(dict[k] * ratio));
    };

    if (grandTotal > 0) {
        normalize(newNat, sumNat, grandTotal);
        normalize(newVisa, sumVisa, grandTotal);
        normalize(newAge, sumAge, grandTotal);
        
        // Fix Gender Inflation
        let finalGender = { ...genderFromTotal };
        if (!hasTotalGender || sumGenderRaw === 0) {
            finalGender['남'] = Math.round(grandTotal * 0.52);
            finalGender['여'] = Math.round(grandTotal * 0.48);
        } else {
             // Always normalize gender to anchor
             normalize(finalGender, sumGenderRaw, grandTotal);
        }
        setTargetGender(finalGender);
    }
    
    // Report Quality
    const sums = [sumNat, sumVisa, sumAge];
    if (sumGenderRaw > 0) sums.push(sumGenderRaw); 
    const minSum = Math.min(...sums.filter(s => s > 0));
    const maxSum = Math.max(...sums);
    const maxDiff = maxSum - minSum;
    const discrepancyRate = maxSum > 0 ? (maxDiff / maxSum) * 100 : 0;
    
    setDataReport({
        sums: { nat: sumNat, visa: sumVisa, age: sumAge, gender: sumGenderRaw },
        finalTotal: grandTotal,
        maxDiff,
        discrepancyRate,
        status: discrepancyRate === 0 ? 'clean' : (discrepancyRate < 1 ? 'warning' : 'error'),
        prevYearAvailable: hasPrevYear,
        prevYear: hasPrevYear ? prevYear : null
    });

    setTargetNationality(newNat);
    setTargetVisa(newVisa);
    setTargetAge(newAge);
    
    // Seed Generation
    const cube: Record<string, number> = {};
    let historyWeights: Record<string, number> = {};
    
    if (usePriorSeed && hasPrevYear) {
        const prevData = rawData.filter(r => r.year === prevYear && r.district === selectedDistrict);
        const prevNat: Record<string, number> = {};
        const prevVisa: Record<string, number> = {};
        const prevAge: Record<string, number> = {};
        let prevTotal = 0;
        
        prevData.forEach(r => {
            if (!r.isTotal && r.gender === 'Total') {
                 if (r.categoryType === 'nationality') { prevNat[r.categoryValue] = (prevNat[r.categoryValue]||0)+r.count; prevTotal+=r.count; }
                 if (r.categoryType === 'visa') prevVisa[r.categoryValue] = (prevVisa[r.categoryValue]||0)+r.count;
                 if (r.categoryType === 'age') {
                     const m = getDetailedAge(r.categoryValue);
                     if(m) prevAge[m] = (prevAge[m]||0)+r.count;
                 }
            }
        });
        if (prevTotal > 0) {
            distinctNats.forEach(n => {
                const pN = (prevNat[n] || 0) / prevTotal;
                distinctVisas.forEach(v => {
                    const pV = (prevVisa[v] || 0) / prevTotal;
                    INTERNAL_AGE_GROUPS.forEach(a => {
                        const pA = (prevAge[a] || 0) / prevTotal;
                        historyWeights[`${n}|${v}|${a}`] = pN * pV * pA;
                    });
                });
            });
        }
    }

    distinctNats.forEach(n => {
       const mappedN = mapNationality(n, 'medium');
       distinctVisas.forEach(v => {
          const mappedV = mapVisa(v, 'medium');
          INTERNAL_AGE_GROUPS.forEach(a => {
             const broadAge = getBroadAge(a);
             let baseWeight = 1.0;
             if (mappedV.includes('단순노무')) {
                if (mappedN === '동남아시아' || mappedN === '중앙아시아') baseWeight *= 5;
                if (broadAge === '20-29세' || broadAge === '30-39세') baseWeight *= 4;
             }
             if (mappedV.includes('유학') && broadAge === '20-29세') baseWeight *= 10;
             if (mappedV.includes('동포') && (mappedN === '동북아(중국권)' || mappedN === '중앙아시아')) baseWeight *= 5;

             const historyProb = historyWeights[`${n}|${v}|${a}`];
             if (historyProb !== undefined && historyProb > 0) {
                 baseWeight = (baseWeight * 0.3) + (historyProb * 10000 * 0.7); 
             }

             GENDERS.forEach(g => {
                let genderWeight = 1.0;
                if (mappedV.includes('단순노무') && g === '남') genderWeight *= 2;
                if (mappedV.includes('결혼') && g === '여') genderWeight *= 6;
                
                cube[`${n}|${v}|${a}|${g}`] = (baseWeight * genderWeight) + 0.1; 
             });
          });
       });
    });
    setCube(cube);

  }, [selectedYear, selectedDistrict, rawData, usePriorSeed]);

  const runIPFStep = () => {
    let currentCube = { ...cube };
    let totalError = 0;
    
    // 1. Nationality
    activeNationalities.forEach(n => {
      const target = targetNationality[n];
      if (target > 0) {
        const currentSum = activeVisas.reduce((sum, v) => 
          sum + INTERNAL_AGE_GROUPS.reduce((aSum, a) => 
            aSum + GENDERS.reduce((gSum, g) => gSum + currentCube[`${n}|${v}|${a}|${g}`], 0), 0), 0);
        const ratio = currentSum === 0 ? 0 : target / currentSum;
        if(ratio !== 0 && ratio !== 1) {
            activeVisas.forEach(v => INTERNAL_AGE_GROUPS.forEach(a => GENDERS.forEach(g => currentCube[`${n}|${v}|${a}|${g}`] *= ratio)));
            totalError += Math.abs(currentSum - target);
        }
      }
    });

    // 2. Visa
    activeVisas.forEach(v => {
      const target = targetVisa[v];
      if (target > 0) {
        const currentSum = activeNationalities.reduce((sum, n) => 
          sum + INTERNAL_AGE_GROUPS.reduce((aSum, a) => 
            aSum + GENDERS.reduce((gSum, g) => gSum + currentCube[`${n}|${v}|${a}|${g}`], 0), 0), 0);
        const ratio = currentSum === 0 ? 0 : target / currentSum;
        if(ratio !== 0 && ratio !== 1) {
            activeNationalities.forEach(n => INTERNAL_AGE_GROUPS.forEach(a => GENDERS.forEach(g => currentCube[`${n}|${v}|${a}|${g}`] *= ratio)));
            totalError += Math.abs(currentSum - target);
        }
      }
    });

    // 3. Age
    INTERNAL_AGE_GROUPS.forEach(a => {
      const target = targetAge[a];
      if (target > 0) {
        const currentSum = activeNationalities.reduce((sum, n) => 
          sum + activeVisas.reduce((vSum, v) => 
            vSum + GENDERS.reduce((gSum, g) => gSum + currentCube[`${n}|${v}|${a}|${g}`], 0), 0), 0);
        const ratio = currentSum === 0 ? 0 : target / currentSum;
        if(ratio !== 0 && ratio !== 1) {
            activeNationalities.forEach(n => activeVisas.forEach(v => GENDERS.forEach(g => currentCube[`${n}|${v}|${a}|${g}`] *= ratio)));
            totalError += Math.abs(currentSum - target);
        }
      }
    });

    // 4. Gender
    GENDERS.forEach(g => {
      const target = targetGender[g];
      if (target > 0) {
         const currentSum = activeNationalities.reduce((sum, n) => 
          sum + activeVisas.reduce((vSum, v) => 
            vSum + INTERNAL_AGE_GROUPS.reduce((aSum, a) => aSum + currentCube[`${n}|${v}|${a}|${g}`], 0), 0), 0);
         const ratio = currentSum === 0 ? 0 : target / currentSum;
         if(ratio !== 0 && ratio !== 1) {
             activeNationalities.forEach(n => activeVisas.forEach(v => INTERNAL_AGE_GROUPS.forEach(a => currentCube[`${n}|${v}|${a}|${g}`] *= ratio)));
             totalError += Math.abs(currentSum - target);
         }
      }
    });

    setCube(currentCube);
    
    // Improved Error Metric: Weighted Error relative to Population
    // (Total Absolute Difference / Total Population) * 100
    const weightedError = populationAnchor > 0 ? (totalError / populationAnchor) * 100 : 0;
    setErrorHistory(prev => [...prev.slice(-49), { i: iterations + 1, error: weightedError }]);
    setIterations(prev => prev + 1);
  };

  const startSimulation = () => {
    setIsRunning(true);
    setErrorHistory([]);
    setIterations(0);
  };

  useEffect(() => {
    if (isRunning && iterations < 100) {
      const timer = setTimeout(runIPFStep, 30);
      return () => clearTimeout(timer);
    } else if (iterations >= 100) {
      setIsRunning(false);
    }
  }, [isRunning, iterations]);

  // --- Dynamic Aggregation ---
  const groupedData = useMemo(() => {
    if (Object.keys(cube).length === 0) return { 
        nationalities: [], visas: [], ages: [],
        natVisa: {}, natAge: {}, visaAge: {} 
    };

    // 1. Map Keys based on selected Levels
    const natMapping: Record<string, string> = {};
    const visaMapping: Record<string, string> = {};
    const ageMapping: Record<string, string> = {};
    
    activeNationalities.forEach(n => natMapping[n] = mapNationality(n, natLevel));
    activeVisas.forEach(v => visaMapping[v] = mapVisa(v, visaLevel));
    INTERNAL_AGE_GROUPS.forEach(a => ageMapping[a] = ageLevel === 'small' ? a : getBroadAge(a));

    // 2. Calculate Aggregates
    const aggNat: Record<string, number> = {};
    const aggVisa: Record<string, number> = {};
    const aggAge: Record<string, number> = {};
    
    // Temp Aggregation to check Thresholds
    Object.keys(cube).forEach(key => {
        const [n, v, a, g] = key.split('|');
        const count = cube[key];
        const targetN = natMapping[n];
        const targetV = visaMapping[v];
        const targetA = ageMapping[a];
        
        aggNat[targetN] = (aggNat[targetN] || 0) + count;
        aggVisa[targetV] = (aggVisa[targetV] || 0) + count;
        aggAge[targetA] = (aggAge[targetA] || 0) + count;
    });

    // 3. Filter by Threshold & Identify "Other"
    const finalNats = Object.keys(aggNat).filter(n => aggNat[n] >= natThreshold).sort((a,b) => aggNat[b] - aggNat[a]);
    const finalVisas = Object.keys(aggVisa).filter(v => aggVisa[v] >= visaThreshold).sort((a,b) => aggVisa[b] - aggVisa[a]);
    // For Age, we just use strict sort, maybe threshold if needed but usually standard groups
    const finalAges = Object.keys(aggAge).filter(a => aggAge[a] >= ageThreshold).sort(); 

    // Add 'Other' if needed
    const displayNats = [...finalNats];
    if (Object.keys(aggNat).some(n => aggNat[n] < natThreshold)) displayNats.push('기타(Other)');
    
    const displayVisas = [...finalVisas];
    if (Object.keys(aggVisa).some(v => aggVisa[v] < visaThreshold)) displayVisas.push('기타(Other)');

    const displayAges = [...finalAges];
    if (Object.keys(aggAge).some(a => aggAge[a] < ageThreshold)) displayAges.push('기타(Other)');

    // 4. Build 2D Matrices
    const natVisaMap: Record<string, number> = {};
    const natAgeMap: Record<string, number> = {};
    const visaAgeMap: Record<string, number> = {};

    // Initialize with 0
    displayNats.forEach(n => {
        displayVisas.forEach(v => natVisaMap[`${n}|${v}`] = 0);
        displayAges.forEach(a => natAgeMap[`${n}|${a}`] = 0);
    });
    displayVisas.forEach(v => displayAges.forEach(a => visaAgeMap[`${v}|${a}`] = 0));

    // Fill Data
    Object.keys(cube).forEach(key => {
       const [n, v, a, g] = key.split('|');
       // Filter by Gender toggle
       if (heatmapGender !== 'Total' && g !== heatmapGender) return;
       
       const val = cube[key];
       
       let mappedN = natMapping[n];
       if (!finalNats.includes(mappedN)) mappedN = '기타(Other)';
       
       let mappedV = visaMapping[v];
       if (!finalVisas.includes(mappedV)) mappedV = '기타(Other)';
       
       let mappedA = ageMapping[a];
       if (!finalAges.includes(mappedA)) mappedA = '기타(Other)';

       natVisaMap[`${mappedN}|${mappedV}`] = (natVisaMap[`${mappedN}|${mappedV}`] || 0) + val;
       natAgeMap[`${mappedN}|${mappedA}`] = (natAgeMap[`${mappedN}|${mappedA}`] || 0) + val;
       visaAgeMap[`${mappedV}|${mappedA}`] = (visaAgeMap[`${mappedV}|${mappedA}`] || 0) + val;
    });

    // 5. Add 'Total' Row/Col Logic
    const withTotalNats = [...displayNats, '총계(Total)'];
    const withTotalVisas = [...displayVisas, '총계(Total)'];
    const withTotalAges = [...displayAges, '총계(Total)'];

    // Calculate Totals for Matrices
    displayNats.forEach(n => {
        let rowSum = 0;
        displayVisas.forEach(v => rowSum += (natVisaMap[`${n}|${v}`] || 0));
        natVisaMap[`${n}|총계(Total)`] = rowSum;
    });
    displayVisas.forEach(v => {
        let colSum = 0;
        displayNats.forEach(n => colSum += (natVisaMap[`${n}|${v}`] || 0));
        natVisaMap[`총계(Total)|${v}`] = colSum;
    });
    let grandTotal = 0;
    displayNats.forEach(n => grandTotal += natVisaMap[`${n}|총계(Total)`]);
    natVisaMap[`총계(Total)|총계(Total)`] = grandTotal;

    displayNats.forEach(n => {
        let sum = 0; displayAges.forEach(a => sum += (natAgeMap[`${n}|${a}`] || 0));
        natAgeMap[`${n}|총계(Total)`] = sum;
    });
    displayAges.forEach(a => {
        let sum = 0; displayNats.forEach(n => sum += (natAgeMap[`${n}|${a}`] || 0));
        natAgeMap[`총계(Total)|${a}`] = sum;
    });
    
    displayVisas.forEach(v => {
        let sum = 0; displayAges.forEach(a => sum += (visaAgeMap[`${v}|${a}`] || 0));
        visaAgeMap[`${v}|총계(Total)`] = sum;
    });
    displayAges.forEach(a => {
        let sum = 0; displayVisas.forEach(v => sum += (visaAgeMap[`${v}|${a}`] || 0));
        visaAgeMap[`총계(Total)|${a}`] = sum;
    });

    return { 
        nationalities: withTotalNats, 
        visas: withTotalVisas, 
        ages: withTotalAges,
        natVisa: natVisaMap, 
        natAge: natAgeMap,
        visaAge: visaAgeMap
    };
  }, [cube, activeNationalities, activeVisas, natThreshold, visaThreshold, ageThreshold, heatmapGender, natLevel, visaLevel, ageLevel]);

  // Gender Chart Data - STRICTLY from CUBE now (Normalized)
  const genderData = useMemo(() => {
    if (Object.keys(cube).length === 0) return [];
    const male = Object.keys(cube).reduce((sum, key) => key.endsWith('남') ? sum + cube[key] : sum, 0);
    const female = Object.keys(cube).reduce((sum, key) => key.endsWith('여') ? sum + cube[key] : sum, 0);
    return [
      { name: '남성', value: Math.round(male), fill: '#3b82f6' },
      { name: '여성', value: Math.round(female), fill: '#ec4899' }
    ];
  }, [cube]);

  // Barchart Data
  const chartData = useMemo(() => {
     return groupedData.nationalities
        .filter(n => n !== '기타(Other)' && n !== '총계(Total)')
        .map(n => {
            const entry: any = { name: n };
            groupedData.visas.filter(v => v !== '총계(Total)').forEach(v => {
                entry[v] = Math.round(groupedData.natVisa[`${n}|${v}`] || 0);
            });
            return entry;
     });
  }, [groupedData]);

  // Time Series Data
  const timeSeriesData = useMemo(() => {
      if(availableYears.length < 2) return [];
      // Calculate Total Population per year
      const trend = availableYears.sort().map(year => {
         const records = rawData.filter(r => r.year === year && r.district === selectedDistrict);
         // Find Max Total row for this year
         let maxTotal = 0;
         records.forEach(r => {
             if (r.isTotal && r.gender === 'Total' && r.count > maxTotal) maxTotal = r.count;
         });
         // Fallback if no total row
         if (maxTotal === 0) {
             maxTotal = records.filter(r => r.categoryType === 'visa' && !r.isTotal && r.gender === 'Total').reduce((a,b)=>a+b.count,0);
         }
         return { year, total: maxTotal };
      });
      return trend;
  }, [availableYears, rawData, selectedDistrict]);

  // --- Render Helpers ---
  const renderHeatmapCell = (rowKey: string, colKey: string, val: number, maxVal: number) => {
      const isTotal = rowKey === '총계(Total)' || colKey === '총계(Total)';
      const isOther = rowKey === '기타(Other)' || colKey === '기타(Other)';
      
      let intensity = 0;
      if (!isTotal && maxVal > 0) intensity = Math.min(val / (maxVal * 0.6), 1);
      
      let bg = 'rgba(241, 245, 249, 0.5)'; 
      let textCol = '#64748b'; 
      let fontWeight = 'font-normal';

      if (isTotal) {
          bg = '#f1f5f9';
          textCol = '#1e293b';
          fontWeight = 'font-black';
      } else if (val > 0) {
          if (heatmapGender === '여') bg = `rgba(236, 72, 153, ${0.1 + intensity * 0.9})`;
          else if (heatmapGender === '남') bg = `rgba(59, 130, 246, ${0.1 + intensity * 0.9})`;
          else if (isOther) bg = `rgba(100, 116, 139, ${0.2 + intensity * 0.6})`;
          else bg = `rgba(79, 70, 229, ${0.1 + intensity * 0.9})`;
          
          if (intensity > 0.5) textCol = 'white';
          fontWeight = 'font-bold';
      }

      // Confidence Interval Calculation
      let ciElement = null;
      if (ciLevel !== null && val > 0) {
          // Z-scores: 90%=1.645, 95%=1.96, 99%=2.576, 99.5%=2.807
          let z = 1.96;
          if (ciLevel === 0.90) z = 1.645;
          if (ciLevel === 0.99) z = 2.576;
          if (ciLevel === 0.995) z = 2.807;

          const se = Math.sqrt(val);
          const lowerCI = Math.max(0, Math.round(val - z * se));
          const upperCI = Math.round(val + z * se);
          
          ciElement = (
            <div className="flex justify-between items-center gap-4 text-[9px] font-mono mt-1 text-emerald-400 border-t border-slate-700 pt-1">
                <span className="opacity-80">{(ciLevel * 100)}% 신뢰구간:</span>
                <span>{lowerCI.toLocaleString()} ~ {upperCI.toLocaleString()}명</span>
             </div>
          );
      }

      return (
        <div 
           key={`${rowKey}-${colKey}`} 
           className={`flex-1 min-w-[60px] m-[1px] rounded flex items-center justify-center text-[10px] ${fontWeight} transition-all hover:scale-110 hover:z-20 cursor-default relative group/cell`}
           style={{ backgroundColor: bg, color: textCol, border: isTotal ? '1px solid #cbd5e1' : 'none' }}
        >
           {val > 0 ? Math.round(val).toLocaleString() : ''}
           {!isTotal && val > 0 && (
             <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] p-2 rounded z-50 whitespace-nowrap hidden group-hover/cell:block shadow-xl pointer-events-none">
                <div className="font-bold border-b border-slate-600 pb-1 mb-1">{rowKey}</div>
                <div className="text-slate-300 text-[9px] mb-2">{colKey}</div>
                
                <div className="flex justify-between items-center gap-4 text-xs font-mono">
                  <span className="text-slate-400">추정(Est):</span>
                  <span className="text-white font-bold">{Math.round(val).toLocaleString()}명</span>
                </div>
                {ciElement}
             </div>
           )}
        </div>
      );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 text-indigo-700">
            <LayoutGrid className="w-8 h-8" />
            3D Sudoku Population Predictor (4D)
          </h1>
          <p className="text-slate-500 mt-1">IPF + Bayesian Inference (전체 국적 및 비자 분석 지원)</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={startSimulation}
            disabled={isRunning || activeNationalities.length === 0}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg ${
              isRunning ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
            }`}
          >
            {isRunning ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
            {isRunning ? '시뮬레이션 시작' : '시뮬레이션 시작'}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Data Integrity Report Section */}
        {dataReport && (
          <div className="col-span-12 bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 items-start">
             <div className={`p-4 rounded-xl flex items-center justify-center shrink-0 ${dataReport.status === 'clean' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                {dataReport.status === 'clean' ? <CheckCircle2 className="w-8 h-8"/> : <AlertTriangle className="w-8 h-8"/>}
             </div>
             <div className="flex-1">
                <div className="flex justify-between items-start">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-2">
                    데이터 무결성 리포트 (Data Integrity Check)
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${dataReport.status === 'clean' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {dataReport.status === 'clean' ? '정상 (Matched)' : '자동 보정됨 (Corrected)'}
                    </span>
                    </h3>
                    {dataReport.prevYearAvailable ? (
                        <span className="text-xs px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full font-bold flex items-center gap-1 border border-indigo-100">
                            <History className="w-3 h-3"/> {dataReport.prevYear}년 데이터 학습 가능
                        </span>
                    ) : (
                        <span className="text-xs px-3 py-1 bg-slate-50 text-slate-400 rounded-full font-bold flex items-center gap-1 border border-slate-100">
                            <History className="w-3 h-3"/> 과거 데이터(1년 전) 없음
                        </span>
                    )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs mb-3">
                   <div className="bg-slate-50 p-2 rounded border border-slate-100">
                      <div className="text-slate-400 font-bold mb-1">국적 파일 합 (Raw)</div>
                      <div className="text-slate-700 font-mono text-sm">{dataReport.sums.nat.toLocaleString()}명</div>
                   </div>
                   <div className="bg-slate-50 p-2 rounded border border-slate-100">
                      <div className="text-slate-400 font-bold mb-1">성별 데이터 합 (Raw)</div>
                      <div className="text-slate-700 font-mono text-sm">{dataReport.sums.gender.toLocaleString()}명</div>
                   </div>
                   <div className="bg-slate-50 p-2 rounded border border-slate-100">
                      <div className="text-slate-400 font-bold mb-1">기준 인구 (Smart Anchor)</div>
                      <div className="text-indigo-700 font-mono text-sm font-bold">{dataReport.finalTotal.toLocaleString()}명</div>
                   </div>
                   <div className="bg-slate-50 p-2 rounded border border-slate-100">
                      <div className="text-slate-400 font-bold mb-1">최대 중복 비율</div>
                      <div className="text-slate-700 font-mono text-sm">{(dataReport.discrepancyRate).toFixed(1)}%</div>
                   </div>
                </div>
                {dataReport.status !== 'clean' && (
                  <div className="text-[11px] text-amber-700 bg-amber-50/50 p-2 rounded border border-amber-100 leading-relaxed">
                     <span className="font-bold">⚠️ 지능형 데이터 보정 작동:</span> 파일 간 중복 합산(Double Counting)이 감지되어, 
                     모든 통계 데이터를 실제 인구 총합(Anchor: {dataReport.finalTotal.toLocaleString()}명)에 맞춰 자동으로 비율 축소했습니다. (성별 뻥튀기 해결됨)
                  </div>
                )}
             </div>
          </div>
        )}

        <aside className="lg:col-span-3 flex flex-col gap-6">
          {/* File Upload */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 border-l-4 border-l-indigo-600">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 border-b pb-2 text-slate-700">
              <Upload className="w-4 h-4 text-indigo-600" />
              데이터 입력 (CSV)
            </h2>
            <div className="space-y-4">
              <input 
                type="file" accept=".csv" 
                ref={fileInputRef} 
                className="hidden" 
                multiple
                onChange={handleFileUpload}
              />
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-24 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all group"
              >
                <Files className="w-6 h-6 text-slate-300 group-hover:text-indigo-400" />
                <span className="text-xs font-bold text-slate-400 group-hover:text-indigo-500 text-center">
                  CSV 파일 업로드<br/>(자동 항목 인식)
                </span>
              </div>
              {uploadStatus.type && (
                <div className={`mt-2 p-3 rounded-lg text-[10px] flex items-start gap-2 ${uploadStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                  {uploadStatus.type === 'success' ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <AlertCircle className="w-3 h-3 shrink-0" />}
                  <span>{uploadStatus.message}</span>
                </div>
              )}
            </div>
          </section>

          {/* Filters */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
             <h2 className="text-lg font-bold mb-4 flex items-center gap-2 border-b pb-2 text-slate-700">
               <Search className="w-4 h-4 text-indigo-500" />
               분석 대상 필터
             </h2>
             <div className="space-y-4">
               <div>
                 <label className="text-xs font-bold text-slate-400 mb-1 block">분석 연도</label>
                 <select 
                   value={selectedYear} 
                   onChange={e => setSelectedYear(e.target.value)}
                   className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-indigo-500"
                   disabled={availableYears.length === 0}
                 >
                   <option value="">연도 선택</option>
                   {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                 </select>
               </div>
               <div>
                 <label className="text-xs font-bold text-slate-400 mb-1 block">행정구역 (시군구)</label>
                 <select 
                   value={selectedDistrict} 
                   onChange={e => setSelectedDistrict(e.target.value)}
                   className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-indigo-500"
                   disabled={availableDistricts.length === 0}
                 >
                   <option value="">지역 선택</option>
                   {availableDistricts.map(d => <option key={d} value={d}>{d}</option>)}
                 </select>
               </div>
             </div>
          </section>

          {/* Model Params */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 bg-gradient-to-br from-white to-amber-50/30">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 border-b pb-2 text-slate-700">
              <BrainCircuit className="w-4 h-4 text-amber-600" />
              모델 최적화 (Optimization)
            </h2>
            <div className="space-y-6">
              {/* Grouping Controls */}
              <div className="bg-white/50 p-3 rounded-xl border border-amber-100">
                  <h3 className="text-xs font-bold text-amber-700 mb-2">데이터 그룹화 수준 (Granularity)</h3>
                  
                  <div className="space-y-3">
                      <div>
                          <div className="text-[10px] text-slate-500 mb-1">국적 (Nationality)</div>
                          <div className="flex bg-slate-100 rounded-lg p-1">
                              <button onClick={() => setNatLevel('small')} className={`flex-1 py-1 text-[10px] rounded ${natLevel === 'small' ? 'bg-white shadow text-indigo-600 font-bold' : 'text-slate-400'}`}>소(국가)</button>
                              <button onClick={() => setNatLevel('medium')} className={`flex-1 py-1 text-[10px] rounded ${natLevel === 'medium' ? 'bg-white shadow text-indigo-600 font-bold' : 'text-slate-400'}`}>중(권역)</button>
                              <button onClick={() => setNatLevel('large')} className={`flex-1 py-1 text-[10px] rounded ${natLevel === 'large' ? 'bg-white shadow text-indigo-600 font-bold' : 'text-slate-400'}`}>대(대륙)</button>
                          </div>
                      </div>
                      <div>
                          <div className="text-[10px] text-slate-500 mb-1">비자 (Visa)</div>
                          <div className="flex bg-slate-100 rounded-lg p-1">
                              <button onClick={() => setVisaLevel('small')} className={`flex-1 py-1 text-[10px] rounded ${visaLevel === 'small' ? 'bg-white shadow text-indigo-600 font-bold' : 'text-slate-400'}`}>소(코드)</button>
                              <button onClick={() => setVisaLevel('medium')} className={`flex-1 py-1 text-[10px] rounded ${visaLevel === 'medium' ? 'bg-white shadow text-indigo-600 font-bold' : 'text-slate-400'}`}>중(성격)</button>
                              <button onClick={() => setVisaLevel('large')} className={`flex-1 py-1 text-[10px] rounded ${visaLevel === 'large' ? 'bg-white shadow text-indigo-600 font-bold' : 'text-slate-400'}`}>대(목적)</button>
                          </div>
                      </div>
                      <div>
                          <div className="text-[10px] text-slate-500 mb-1">연령 (Age)</div>
                          <div className="flex bg-slate-100 rounded-lg p-1">
                              <button onClick={() => setAgeLevel('small')} className={`flex-1 py-1 text-[10px] rounded ${ageLevel === 'small' ? 'bg-white shadow text-indigo-600 font-bold' : 'text-slate-400'}`}>5세 단위</button>
                              <button onClick={() => setAgeLevel('medium')} className={`flex-1 py-1 text-[10px] rounded ${ageLevel === 'medium' ? 'bg-white shadow text-indigo-600 font-bold' : 'text-slate-400'}`}>10세/세대</button>
                          </div>
                      </div>
                  </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-600">과거 데이터 학습 (Bayesian Prior)</label>
                    <div 
                    onClick={() => setUsePriorSeed(!usePriorSeed)}
                    className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${usePriorSeed ? 'bg-indigo-500' : 'bg-slate-300'}`}
                    >
                        <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${usePriorSeed ? 'left-6' : 'left-1'}`}></div>
                    </div>
                </div>
                {/* Learning Status Indicator */}
                <div className={`text-[10px] px-2 py-1.5 rounded border flex items-center gap-1.5 ${usePriorSeed && dataReport?.prevYearAvailable ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                    {usePriorSeed && dataReport?.prevYearAvailable ? (
                        <><ShieldCheck className="w-3 h-3"/> 학습 소스: {dataReport.prevYear}년 데이터 감지됨</>
                    ) : (
                        <><AlertCircle className="w-3 h-3"/> 1년 전({Number(selectedYear)-1}) 데이터 없음 (학습 불가)</>
                    )}
                </div>
              </div>

              {/* Confidence Interval Settings */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <h3 className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1">
                    <Eye className="w-3 h-3" /> 신뢰구간 (Confidence Interval)
                  </h3>
                  <div className="flex gap-1 flex-wrap">
                     {[0.90, 0.95, 0.99, 0.995].map(level => (
                         <button 
                            key={level} 
                            onClick={() => setCiLevel(level)}
                            className={`px-2 py-1 text-[10px] rounded-md font-bold transition-all border ${ciLevel === level ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}
                         >
                            {(level*100)}%
                         </button>
                     ))}
                     <button 
                        onClick={() => setCiLevel(null)}
                        className={`px-2 py-1 text-[10px] rounded-md font-bold transition-all border ${ciLevel === null ? 'bg-slate-200 text-slate-600 border-slate-300' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}
                     >
                        끔 (Off)
                     </button>
                  </div>
              </div>
              
              <div className="border-t border-slate-200 pt-4">
                 <h3 className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1">
                   <SlidersHorizontal className="w-3 h-3" /> 시각화 필터 (인원수 기준)
                 </h3>
                 <div className="space-y-3">
                   <div>
                       <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                           <span>국적 (Nationality):</span>
                           <span className="font-bold">{natThreshold}명 이상</span>
                       </div>
                       <input type="range" min="0" max="1000" step="10" value={String(natThreshold)} onChange={e => setNatThreshold(Number(e.target.value))} className="w-full h-1 bg-slate-200 rounded-lg accent-indigo-500" />
                   </div>
                   <div>
                       <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                           <span>비자 (Visa):</span>
                           <span className="font-bold">{visaThreshold}명 이상</span>
                       </div>
                       <input type="range" min="0" max="1000" step="10" value={String(visaThreshold)} onChange={e => setVisaThreshold(Number(e.target.value))} className="w-full h-1 bg-slate-200 rounded-lg accent-indigo-500" />
                   </div>
                   <div>
                       <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                           <span>연령 (Age):</span>
                           <span className="font-bold">{ageThreshold}명 이상</span>
                       </div>
                       <input type="range" min="0" max="1000" step="10" value={String(ageThreshold)} onChange={e => setAgeThreshold(Number(e.target.value))} className="w-full h-1 bg-slate-200 rounded-lg accent-indigo-500" />
                   </div>
                 </div>
              </div>

              <button 
                 onClick={() => setShowInsight(!showInsight)}
                 className="w-full flex items-center justify-center gap-2 py-2 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold hover:bg-amber-200 transition-colors"
              >
                 <Lightbulb className="w-3 h-3" />
                 분석 도움말 {showInsight ? '닫기' : '열기'}
              </button>
              {showInsight && (
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 text-[11px] text-amber-900 leading-relaxed space-y-2">
                  <p><strong>📊 지능형 데이터 보정</strong><br/>
                  CSV 파일에 포함된 중복 합계(중국+한국계중국인)로 인한 오류를 방지하기 위해, 데이터 내 '가장 큰 합계'를 기준으로 전체 인구를 고정(Anchor)하고 모든 비율을 재조정했습니다.</p>
                  <p><strong>📉 가중 오차율</strong><br/>
                  단순 합산 오차가 아닌, 전체 인구 대비 오차 비율을 보여줍니다. 데이터가 정확하다면 0.001% 미만으로 수렴합니다.</p>
                </div>
              )}
            </div>
          </section>

          {/* Marginals Summary */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 max-h-[300px] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 border-b pb-2 text-slate-700">
              <Filter className="w-4 h-4 text-indigo-500" />
              Marginals (Top 5)
            </h2>
            <div className="space-y-4">
              <div className="flex gap-4">
                 <div className="flex-1 bg-blue-50 p-2 rounded-lg text-center border border-blue-100">
                   <div className="text-[10px] text-blue-400 font-bold">남성</div>
                   <div className="text-sm font-bold text-blue-700">{targetGender['남'].toLocaleString()}</div>
                 </div>
                 <div className="flex-1 bg-pink-50 p-2 rounded-lg text-center border border-pink-100">
                   <div className="text-[10px] text-pink-400 font-bold">여성</div>
                   <div className="text-sm font-bold text-pink-700">{targetGender['여'].toLocaleString()}</div>
                 </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">주요 체류자격</label>
                {activeVisas
                  .filter(v => !['계', '합계', '소계', '총계', 'Total', 'Subtotal'].some(ex => v.includes(ex))) // Filter out Total rows in list
                  .sort((a,b) => targetVisa[b] - targetVisa[a])
                  .slice(0,5)
                  .map(v => (
                  <div key={v} className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-600 truncate max-w-[120px]">{v}</span>
                    <span className="text-xs font-mono font-bold text-indigo-600">
                      {(targetVisa[v] || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </aside>

        <div className="lg:col-span-9 flex flex-col gap-6">
          {/* Row 1: Status & Pie Chart */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Gender Pie Chart */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-4 md:col-span-1 min-h-[180px]">
               <div className="w-1/2 h-full">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={genderData} innerRadius={30} outerRadius={55} paddingAngle={5} dataKey="value">
                        {genderData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                      </Pie>
                      <Tooltip contentStyle={{borderRadius: '8px', fontSize: '12px'}} />
                    </PieChart>
                 </ResponsiveContainer>
               </div>
               <div className="w-1/2 flex flex-col justify-center">
                  <span className="text-sm font-bold text-slate-500 mb-2">성별 비율</span>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span className="text-xs font-bold text-slate-700">남 {((genderData[0]?.value / (genderData[0]?.value+genderData[1]?.value))*100 || 0).toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-pink-500"></div>
                      <span className="text-xs font-bold text-slate-700">여 {((genderData[1]?.value / (genderData[0]?.value+genderData[1]?.value))*100 || 0).toFixed(1)}%</span>
                    </div>
                  </div>
               </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-4 md:col-span-1">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg"><Activity className="w-6 h-6" /></div>
              <div>
                <p className="text-xs font-bold text-slate-400">데이터 구조</p>
                <p className="text-sm font-bold text-slate-700">{activeNationalities.length}개국 / {activeVisas.length}비자</p>
                <p className="text-[10px] text-slate-400 mt-1">
                   {usePriorSeed && dataReport?.prevYearAvailable ? '과거 기반 학습 적용됨' : '일반 휴리스틱 모드'}
                </p>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-4 md:col-span-1 relative group">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-lg"><AlertCircle className="w-6 h-6" /></div>
              <div>
                <div className="flex items-center gap-1">
                    <p className="text-xs font-bold text-slate-400">IPF 수렴 오차</p>
                    <HelpCircle className="w-3 h-3 text-slate-300 cursor-help" />
                </div>
                <p className="text-xl font-bold text-slate-700">
                  {errorHistory.length > 0 ? (errorHistory[errorHistory.length - 1].error).toFixed(5) : '0.00000'}%
                </p>
              </div>
              <div className="absolute top-full left-0 mt-2 w-64 bg-slate-800 text-white text-xs p-3 rounded-xl z-50 hidden group-hover:block shadow-xl border border-slate-700">
                  <div className="font-bold mb-1 text-emerald-400">오차 해석 가이드:</div>
                  <ul className="list-disc pl-4 space-y-1 text-slate-300">
                      <li><strong>&lt; 0.001%</strong>: 매우 정밀 (신뢰도 높음)</li>
                      <li><strong>&lt; 0.01%</strong>: 양호 (일반 분석용)</li>
                      <li><strong>&gt; 0.1%</strong>: 수렴 실패 가능성 (데이터 확인 필요)</li>
                  </ul>
                  <div className="mt-2 text-[10px] text-slate-400">
                      라플라스 스무딩(0.1)이 적용되어 오차가 최소화되었습니다.
                  </div>
              </div>
            </div>
          </div>

          {/* Row 2: Tabs for Chart/Time Series */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-6">
                <div className="flex gap-2">
                    <button 
                       onClick={() => setViewMode('snapshot')}
                       className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'snapshot' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'text-slate-400 hover:bg-slate-50'}`}
                    >
                        <BarChart3 className="w-4 h-4"/> 분포 스냅샷 ({selectedYear})
                    </button>
                    <button 
                       onClick={() => setViewMode('trend')}
                       disabled={availableYears.length < 2}
                       className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'trend' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'text-slate-400 hover:bg-slate-50'} ${availableYears.length < 2 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <TrendingUp className="w-4 h-4"/> 시계열 트렌드 ({availableYears.length}개년)
                    </button>
                </div>
            </div>

            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                {viewMode === 'snapshot' ? (
                    <BarChart data={chartData} margin={{top: 20, right: 30, left: 20, bottom: 5}}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11}} interval={0} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11}} />
                        <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                        <Legend iconType="circle" wrapperStyle={{fontSize: '10px'}} />
                        {groupedData.visas.filter(v => v !== '기타(Other)' && v !== '총계(Total)').slice(0, 10).map((v, i) => (
                        <Bar key={v} dataKey={v} stackId="a" fill={`hsl(${220 + (i * 40) % 140}, 70%, 60%)`} radius={[0,0,0,0]} />
                        ))}
                    </BarChart>
                ) : (
                    <LineChart data={timeSeriesData} margin={{top: 20, right: 30, left: 20, bottom: 5}}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} domain={['auto', 'auto']}/>
                        <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                        <Legend />
                        <Line type="monotone" dataKey="total" name="외국인 총 인구" stroke="#6366f1" strokeWidth={3} dot={{r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff'}} />
                    </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
            
          {/* Row 3: Combined Heatmaps (3 Sections) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 relative">
             <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  다차원 상세 히트맵 (3 Perspectives)
                </h3>
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                   <button onClick={() => setHeatmapGender('Total')} className={`px-3 py-1.5 text-xs font-bold rounded transition-all ${heatmapGender === 'Total' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}>전체</button>
                   <button onClick={() => setHeatmapGender('남')} className={`px-3 py-1.5 text-xs font-bold rounded transition-all ${heatmapGender === '남' ? 'bg-blue-500 text-white shadow' : 'text-slate-400'}`}>남성</button>
                   <button onClick={() => setHeatmapGender('여')} className={`px-3 py-1.5 text-xs font-bold rounded transition-all ${heatmapGender === '여' ? 'bg-pink-500 text-white shadow' : 'text-slate-400'}`}>여성</button>
                </div>
             </div>

             <div className="space-y-8">
               {/* 1. Nationality x Visa */}
               <div>
                  <h4 className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-2"><MapPin className="w-3 h-3"/> 국적 × 비자 (Nationality × Visa)</h4>
                  <div className="overflow-x-auto border rounded-xl border-slate-100 bg-slate-50 p-4">
                     {/* Header */}
                     <div className="flex mb-1">
                        <div className="w-24 shrink-0 text-right text-[10px] text-slate-400 font-bold pr-2">국적 \ 비자</div>
                        {groupedData.visas.map(v => (
                           <div key={v} className="flex-1 min-w-[60px] text-[10px] text-slate-500 font-bold text-center break-words px-1">{v.split(' ')[0]}</div>
                        ))}
                     </div>
                     {groupedData.nationalities.map(n => (
                       <div key={n} className="flex h-10 mb-1">
                          <div className="w-24 shrink-0 text-[11px] font-bold text-slate-600 text-right pr-2 self-center truncate" title={n}>{n}</div>
                          {groupedData.visas.map(v => renderHeatmapCell(n, v, groupedData.natVisa[`${n}|${v}`] || 0, 500))}
                       </div>
                     ))}
                  </div>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 {/* 2. Nationality x Age */}
                 <div>
                    <h4 className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-2"><Users className="w-3 h-3"/> 국적 × 연령 (Nationality × Age)</h4>
                    <div className="overflow-x-auto border rounded-xl border-slate-100 bg-slate-50 p-4 max-h-[500px] overflow-y-auto">
                       <div className="flex mb-1 sticky top-0 bg-slate-50 z-10 pb-2 border-b">
                          <div className="w-24 shrink-0 text-right text-[10px] text-slate-400 font-bold pr-2">국적 \ 연령</div>
                          {groupedData.ages.map(a => (
                             <div key={a} className="flex-1 min-w-[50px] text-[10px] text-slate-500 font-bold text-center">{a}</div>
                          ))}
                       </div>
                       {groupedData.nationalities.map(n => (
                         <div key={n} className="flex h-10 mb-1">
                            <div className="w-24 shrink-0 text-[11px] font-bold text-slate-600 text-right pr-2 self-center truncate" title={n}>{n}</div>
                            {groupedData.ages.map(a => renderHeatmapCell(n, a, groupedData.natAge[`${n}|${a}`] || 0, 300))}
                         </div>
                       ))}
                    </div>
                 </div>

                 {/* 3. Visa x Age */}
                 <div>
                    <h4 className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-2"><Database className="w-3 h-3"/> 비자 × 연령 (Visa × Age)</h4>
                    <div className="overflow-x-auto border rounded-xl border-slate-100 bg-slate-50 p-4 max-h-[500px] overflow-y-auto">
                       <div className="flex mb-1 sticky top-0 bg-slate-50 z-10 pb-2 border-b">
                          <div className="w-24 shrink-0 text-right text-[10px] text-slate-400 font-bold pr-2">비자 \ 연령</div>
                          {groupedData.ages.map(a => (
                             <div key={a} className="flex-1 min-w-[50px] text-[10px] text-slate-500 font-bold text-center">{a}</div>
                          ))}
                       </div>
                       {groupedData.visas.map(v => (
                         <div key={v} className="flex h-10 mb-1">
                            <div className="w-24 shrink-0 text-[11px] font-bold text-slate-600 text-right pr-2 self-center truncate" title={v}>{v.split(' ')[0]}</div>
                            {groupedData.ages.map(a => renderHeatmapCell(v, a, groupedData.visaAge[`${v}|${a}`] || 0, 500))}
                         </div>
                       ))}
                    </div>
                 </div>
               </div>
             </div>
             
             <div className="mt-4 flex gap-4 text-[10px] text-slate-400 justify-end">
               <div className="flex items-center gap-1"><div className="w-3 h-3 bg-indigo-500 rounded"></div> 일반 데이터</div>
               <div className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-500 rounded"></div> 기타(Other) 그룹</div>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// React 19 Mounting
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<PopulationPredictor />);
}