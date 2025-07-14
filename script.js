let video;
let bodyPose;
let poses = [];
let canvas;
let captureCanvas;
let currentStream;
let videoDevices = [];
let currentDeviceIndex = 0;
let isModelLoaded = false;
let isVideoReady = false;

let chefHatImg;
let apronImg;
let showHat = true;
let showApron = true;
let showBackground = true;
let debugMode = false;

// 조정 가능한 변수들
let hatOffset = 0; // UI 표시용 (실제로는 -100px 오프셋이 적용됨)
let hatSize = 100;
let hatOpacity = 100;
let apronOffset = 0;
let apronSize = 120;
let apronOpacity = 100;

// 캡처된 이미지들
let capturedWithFilters = null;
let capturedOriginal = null;

// 사진 갤러리 배열
let photoGallery = [];


const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;

function preload() {
    // GitHub Pages 호환성을 위한 에셋 로딩
    try {
        console.log('Starting to load image assets...');
        chefHatImg = loadImage('./assets/chef-hat.png', 
            () => {
                console.log('✅ Chef hat image loaded successfully');
                console.log('Chef hat dimensions:', chefHatImg.width, 'x', chefHatImg.height);
            },
            () => {
                console.warn('❌ Chef hat image failed to load, using fallback');
                chefHatImg = null;
            }
        );
        apronImg = loadImage('./assets/apron.png',
            () => {
                console.log('✅ Apron image loaded successfully');
                console.log('Apron dimensions:', apronImg.width, 'x', apronImg.height);
            },
            () => {
                console.warn('❌ Apron image failed to load, using fallback');
                apronImg = null;
            }
        );
    } catch (error) {
        console.error('❌ Error loading images:', error);
        chefHatImg = null;
        apronImg = null;
    }
}

function setup() {
    canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    canvas.parent('canvas-container');
    
    captureCanvas = createGraphics(CANVAS_WIDTH, CANVAS_HEIGHT);
    
    setupCamera();
    setupUI();
    
    // ML5.js v1.2.1 API 사용
    try {
        bodyPose = ml5.bodyPose({
            model: 'MoveNet',
            modelType: 'SINGLEPOSE_THUNDER'
        }, modelReady);
        console.log('bodyPose 객체 생성 완료:', bodyPose);
    } catch (error) {
        console.error('bodyPose 생성 오류:', error);
    }
}

function modelReady() {
    console.log('BodyPose 모델이 준비되었습니다!');
    isModelLoaded = true;
    checkIfReady();
    
    // 비디오가 이미 준비되었다면 detection 시작
    if (video && isVideoReady) {
        console.log('비디오가 준비되어 있으므로 detection을 시작합니다.');
        bodyPose.detectStart(video, gotPoses);
    }
}

function gotPoses(results) {
    poses = results;
    if (debugMode) {
        console.log('gotPoses called with:', results);
    }
}

function checkIfReady() {
    if (isModelLoaded && isVideoReady) {
        hideLoading();
    }
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

async function setupCamera() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        populateCameraSelect();
        
        await initializeCamera();
    } catch (error) {
        console.error('카메라 설정 중 오류:', error);
        alert('카메라에 접근할 수 없습니다. 브라우저 설정을 확인해주세요.');
    }
}

function populateCameraSelect() {
    const select = document.getElementById('camera-select');
    select.innerHTML = '<option value="">카메라 선택...</option>';
    
    videoDevices.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `카메라 ${index + 1}`;
        if (index === currentDeviceIndex) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

async function initializeCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }
    
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    let constraints = {
        video: {
            width: { ideal: CANVAS_WIDTH, max: CANVAS_WIDTH },
            height: { ideal: CANVAS_HEIGHT, max: CANVAS_HEIGHT },
            facingMode: isMobile ? 'user' : undefined
        }
    };
    
    if (videoDevices.length > 0 && videoDevices[currentDeviceIndex]) {
        constraints = {
            video: {
                deviceId: { exact: videoDevices[currentDeviceIndex].deviceId },
                width: { ideal: CANVAS_WIDTH, max: CANVAS_WIDTH },
                height: { ideal: CANVAS_HEIGHT, max: CANVAS_HEIGHT }
            }
        };
    }
    
    try {
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (!video) {
            video = createCapture(VIDEO);
            video.size(CANVAS_WIDTH, CANVAS_HEIGHT);
            video.hide();
        }
        
        video.elt.srcObject = currentStream;
        
        video.elt.onloadeddata = () => {
            console.log('비디오가 준비되었습니다!');
            isVideoReady = true;
            if (bodyPose && isModelLoaded) {
                console.log('모델과 비디오가 모두 준비되어 detection을 시작합니다.');
                bodyPose.detectStart(video, gotPoses);
            }
            checkIfReady();
        };
        
    } catch (error) {
        console.error('카메라 초기화 오류:', error);
        
        try {
            const fallbackConstraints = {
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            };
            
            currentStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
            
            if (!video) {
                video = createCapture(VIDEO);
                video.size(CANVAS_WIDTH, CANVAS_HEIGHT);
                video.hide();
            }
            
            video.elt.srcObject = currentStream;
            
            video.elt.onloadeddata = () => {
                console.log('비디오가 준비되었습니다! (fallback)');
                isVideoReady = true;
                if (bodyPose && isModelLoaded) {
                    console.log('모델과 비디오가 모두 준비되어 detection을 시작합니다. (fallback)');
                    bodyPose.detectStart(video, gotPoses);
                }
                checkIfReady();
            };
            
        } catch (fallbackError) {
            console.error('카메라 fallback 오류:', fallbackError);
            alert('카메라에 접근할 수 없습니다. 브라우저 설정을 확인해주세요.');
        }
    }
}

function setupUI() {
    document.getElementById('switch-camera').addEventListener('click', switchCamera);
    document.getElementById('camera-select').addEventListener('change', onCameraSelect);
    document.getElementById('capture-photo').addEventListener('click', capturePhoto);
    document.getElementById('download-photo').addEventListener('click', downloadPhoto);
    document.getElementById('show-hat').addEventListener('change', (e) => {
        showHat = e.target.checked;
    });
    document.getElementById('show-apron').addEventListener('change', (e) => {
        showApron = e.target.checked;
    });
    document.getElementById('show-background').addEventListener('change', (e) => {
        showBackground = e.target.checked;
    });
    document.getElementById('debug-mode').addEventListener('change', (e) => {
        debugMode = e.target.checked;
    });
    
    // 조정 컨트롤 이벤트 리스너
    setupAdjustmentControls();
    
    // 캡처 버튼 이벤트 리스너
    document.getElementById('capture-original').addEventListener('click', captureOriginalPhoto);
    document.getElementById('capture-both').addEventListener('click', captureBothPhotos);
    document.getElementById('download-original').addEventListener('click', downloadOriginalPhoto);
}

async function switchCamera() {
    if (videoDevices.length > 1) {
        currentDeviceIndex = (currentDeviceIndex + 1) % videoDevices.length;
        await initializeCamera();
        populateCameraSelect();
    }
}

async function onCameraSelect(event) {
    const deviceId = event.target.value;
    if (deviceId) {
        const deviceIndex = videoDevices.findIndex(device => device.deviceId === deviceId);
        if (deviceIndex !== -1) {
            currentDeviceIndex = deviceIndex;
            await initializeCamera();
        }
    }
}

function draw() {
    if (!video || !isVideoReady) {
        background(220);
        fill(100);
        textAlign(CENTER, CENTER);
        textSize(16);
        text('카메라 로딩 중...', width/2, height/2);
        return;
    }
    
    drawBackground();
    
    push();
    scale(-1, 1);
    image(video, -width, 0, width, height);
    pop();
    
    // 디버그 정보 표시
    if (debugMode) {
        fill(255, 255, 255, 200);
        noStroke();
        rect(10, height - 150, 350, 140);
        fill(0);
        textAlign(LEFT, TOP);
        textSize(12);
        text(`Video Ready: ${isVideoReady}`, 15, height - 140);
        text(`Model Loaded: ${isModelLoaded}`, 15, height - 125);
        text(`BodyPose Initialized: ${bodyPose ? 'Yes' : 'No'}`, 15, height - 110);
        text(`Poses Array Length: ${poses.length}`, 15, height - 95);
        text(`Video Size: ${video ? video.width + 'x' + video.height : 'N/A'}`, 15, height - 80);
        text(`Canvas Size: ${width}x${height}`, 15, height - 65);
        text(`Chef Hat Loaded: ${chefHatImg && chefHatImg.width > 0 ? 'Yes' : 'No (using fallback)'}`, 15, height - 50);
        text(`Apron Loaded: ${apronImg && apronImg.width > 0 ? 'Yes' : 'No (using fallback)'}`, 15, height - 35);
        text(`Frame Count: ${frameCount}`, 15, height - 20);
    }
    
    drawPose();
    drawOverlays();
}

function drawBackground() {
    if (showBackground) {
        background(135, 206, 235);
        
        fill(255, 255, 255, 100);
        noStroke();
        for (let i = 0; i < 15; i++) {
            let x = (frameCount * 0.5 + i * 50) % (width + 100);
            let y = 50 + sin(frameCount * 0.02 + i) * 20;
            ellipse(x, y, 30, 30);
        }
        
        fill(255, 255, 255, 150);
        for (let i = 0; i < 10; i++) {
            let x = (frameCount * 0.3 + i * 80) % (width + 100);
            let y = height - 100 + cos(frameCount * 0.015 + i) * 15;
            ellipse(x, y, 20, 20);
        }
        
        fill(255, 255, 255, 80);
        textAlign(LEFT, TOP);
        textSize(40);
        text('🍳', 20, 20);
        text('👨‍🍳', width - 80, 20);
        text('🥄', 20, height - 60);
        text('🍽️', width - 80, height - 60);
    }
}

function drawPose() {
    if (debugMode && poses.length > 0) {
        const pose = poses[0];
        
        // Draw all keypoints
        for (let i = 0; i < pose.keypoints.length; i++) {
            const keypoint = pose.keypoints[i];
            if (keypoint.confidence > 0.2) {
                fill(255, 0, 0);
                noStroke();
                ellipse(width - keypoint.x, keypoint.y, 8, 8);
                
                // Label keypoints
                fill(255);
                stroke(0);
                strokeWeight(1);
                textAlign(CENTER, CENTER);
                textSize(10);
                text(keypoint.name, width - keypoint.x, keypoint.y - 15);
            }
        }
        
        // Draw debug info
        fill(255, 255, 255, 200);
        noStroke();
        rect(10, 10, 200, 100);
        fill(0);
        textAlign(LEFT, TOP);
        textSize(12);
        text(`Poses detected: ${poses.length}`, 15, 25);
        if (poses.length > 0) {
            const nose = pose.keypoints.find(kp => kp.name === 'nose');
            const leftShoulder = pose.keypoints.find(kp => kp.name === 'left_shoulder');
            const rightShoulder = pose.keypoints.find(kp => kp.name === 'right_shoulder');
            
            text(`Nose: ${nose ? nose.confidence.toFixed(2) : 'N/A'}`, 15, 40);
            text(`L Shoulder: ${leftShoulder ? leftShoulder.confidence.toFixed(2) : 'N/A'}`, 15, 55);
            text(`R Shoulder: ${rightShoulder ? rightShoulder.confidence.toFixed(2) : 'N/A'}`, 15, 70);
        }
    }
}

function drawOverlays() {
    if (poses.length > 0) {
        const pose = poses[0];
        
        const nose = pose.keypoints.find(kp => kp.name === 'nose');
        const leftShoulder = pose.keypoints.find(kp => kp.name === 'left_shoulder');
        const rightShoulder = pose.keypoints.find(kp => kp.name === 'right_shoulder');
        
        if (debugMode) {
            console.log('Pose data:', {
                nose: nose ? { x: nose.x, y: nose.y, confidence: nose.confidence } : null,
                leftShoulder: leftShoulder ? { x: leftShoulder.x, y: leftShoulder.y, confidence: leftShoulder.confidence } : null,
                rightShoulder: rightShoulder ? { x: rightShoulder.x, y: rightShoulder.y, confidence: rightShoulder.confidence } : null,
                showHat: showHat,
                showApron: showApron
            });
        }
        
        if (showHat && nose && nose.confidence > 0.3) {
            drawChefHat(nose);
        }
        
        if (showApron && leftShoulder && rightShoulder && 
            leftShoulder.confidence > 0.3 && rightShoulder.confidence > 0.3) {
            drawApron(leftShoulder, rightShoulder);
        }
    } else if (debugMode) {
        console.log('No poses detected');
    }
}

function drawChefHat(nose) {
    const mirroredX = width - nose.x;
    
    // 실제 오프셋 계산 (UI의 0 = 실제 -100px)
    const actualHatOffset = hatOffset - 100;
    
    // 투명도 계산 (100% = 255, 10% = 25.5)
    const hatAlpha = (hatOpacity / 100) * 255;
    
    // 이미지가 로드되고 유효한 경우
    if (chefHatImg && chefHatImg.width > 0) {
        const hatWidth = 120 * (hatSize / 100);
        const hatHeight = 100 * (hatSize / 100);
        const hatX = mirroredX - hatWidth / 2;
        const hatY = nose.y - hatHeight + actualHatOffset;
        
        push();
        tint(255, hatAlpha);
        image(chefHatImg, hatX, hatY, hatWidth, hatHeight);
        pop();
    } else {
        // Fallback: 기본 도형으로 그리기
        fill(255, 255, 255, hatAlpha * 0.8);
        stroke(200, hatAlpha);
        strokeWeight(2);
        
        const hatWidth = 100 * (hatSize / 100);
        const hatHeight = 80 * (hatSize / 100);
        const hatX = mirroredX - hatWidth / 2;
        const hatY = nose.y - hatHeight + actualHatOffset;
        
        // 요리사 모자 모양
        ellipse(mirroredX, hatY + 20, hatWidth, 40);
        rect(hatX + 20, hatY, hatWidth - 40, 50);
        
        fill(0, hatAlpha);
        textAlign(CENTER, CENTER);
        textSize(16);
        text('👨‍🍳', mirroredX, hatY + 25);
    }
}

function drawApron(leftShoulder, rightShoulder) {
    const mirroredLeftX = width - leftShoulder.x;
    const mirroredRightX = width - rightShoulder.x;
    
    // 투명도 계산 (100% = 255, 10% = 25.5)
    const apronAlpha = (apronOpacity / 100) * 255;
    
    // 이미지가 로드되고 유효한 경우
    if (apronImg && apronImg.width > 0) {
        const shoulderMidX = (mirroredLeftX + mirroredRightX) / 2;
        const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
        
        const apronWidth = Math.abs(mirroredLeftX - mirroredRightX) * (apronSize / 100) * 1.5;
        const apronHeight = apronWidth * 1.2;
        const apronX = shoulderMidX - apronWidth / 2;
        const apronY = shoulderMidY + apronOffset;
        
        push();
        tint(255, apronAlpha);
        image(apronImg, apronX, apronY, apronWidth, apronHeight);
        pop();
    } else {
        // Fallback: 기본 도형으로 그리기
        const shoulderMidX = (mirroredLeftX + mirroredRightX) / 2;
        const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
        
        fill(255, 255, 255, apronAlpha * 0.7);
        stroke(200, apronAlpha);
        strokeWeight(2);
        
        const apronWidth = Math.abs(mirroredLeftX - mirroredRightX) * (apronSize / 100);
        const apronHeight = apronWidth * 1.3;
        const apronX = shoulderMidX - apronWidth / 2;
        const apronY = shoulderMidY + apronOffset;
        
        // 앞치마 모양
        rect(apronX, apronY, apronWidth, apronHeight, 10);
        
        // 끈
        const neckStrapY = shoulderMidY - 20;
        line(mirroredLeftX, leftShoulder.y, apronX + 20, neckStrapY);
        line(mirroredRightX, rightShoulder.y, apronX + apronWidth - 20, neckStrapY);
        
        fill(0, apronAlpha);
        textAlign(CENTER, CENTER);
        textSize(16);
        text('🍳', shoulderMidX, apronY + apronHeight / 3);
    }
}

function capturePhoto() {
    if (!video || !isVideoReady) {
        alert('카메라가 준비되지 않았습니다.');
        return;
    }
    
    // 실제 비디오 크기 가져오기
    const videoWidth = video.elt.videoWidth || video.width;
    const videoHeight = video.elt.videoHeight || video.height;
    
    console.log('Video dimensions:', videoWidth, 'x', videoHeight);
    console.log('Canvas dimensions:', CANVAS_WIDTH, 'x', CANVAS_HEIGHT);
    console.log('Chef hat image loaded:', chefHatImg && chefHatImg.width > 0);
    console.log('Apron image loaded:', apronImg && apronImg.width > 0);
    console.log('Poses detected:', poses.length);
    
    // 캡처 캔버스를 비디오 실제 크기로 생성
    const tempCanvas = createGraphics(videoWidth, videoHeight);
    
    tempCanvas.clear();
    
    if (showBackground) {
        drawBackgroundOnCanvas(tempCanvas, videoWidth, videoHeight);
    }
    
    // 비디오를 실제 크기로 그리기 (미러링)
    tempCanvas.push();
    tempCanvas.scale(-1, 1);
    tempCanvas.image(video, -videoWidth, 0, videoWidth, videoHeight);
    tempCanvas.pop();
    
    // 오버레이 추가 (좌표 스케일링)
    if (poses.length > 0) {
        const pose = poses[0];
        
        const scaleX = videoWidth / CANVAS_WIDTH;
        const scaleY = videoHeight / CANVAS_HEIGHT;
        
        const nose = pose.keypoints.find(kp => kp.name === 'nose');
        const leftShoulder = pose.keypoints.find(kp => kp.name === 'left_shoulder');
        const rightShoulder = pose.keypoints.find(kp => kp.name === 'right_shoulder');
        
        if (showHat && nose && nose.confidence > 0.3) {
            const scaledNose = { 
                x: videoWidth - (nose.x * scaleX), 
                y: nose.y * scaleY 
            };
            drawChefHatOnCanvas(tempCanvas, scaledNose, scaleX, scaleY);
        }
        
        if (showApron && leftShoulder && rightShoulder && 
            leftShoulder.confidence > 0.3 && rightShoulder.confidence > 0.3) {
            const scaledLeftShoulder = { 
                x: videoWidth - (leftShoulder.x * scaleX), 
                y: leftShoulder.y * scaleY 
            };
            const scaledRightShoulder = { 
                x: videoWidth - (rightShoulder.x * scaleX), 
                y: rightShoulder.y * scaleY 
            };
            drawApronOnCanvas(tempCanvas, scaledLeftShoulder, scaledRightShoulder, scaleX, scaleY);
        }
    }
    
    // 전역 변수에 저장 (다운로드용)
    capturedWithFilters = tempCanvas;
    
    // 갤러리에 추가
    addPhotoToGallery(tempCanvas, 'filtered');
}

function drawChefHatOnCanvas(canvas, nose, scaleX = 1, scaleY = 1) {
    // 실제 오프셋 계산 (UI의 0 = 실제 -100px)
    const actualHatOffset = hatOffset - 100;
    
    // 투명도 계산 (100% = 255, 10% = 25.5)
    const hatAlpha = (hatOpacity / 100) * 255;
    
    // 이미지가 로드되고 유효한 경우
    if (chefHatImg && chefHatImg.width > 0) {
        const hatWidth = 120 * (hatSize / 100) * scaleX;
        const hatHeight = 100 * (hatSize / 100) * scaleY;
        const hatX = nose.x - hatWidth / 2;
        const hatY = nose.y - hatHeight + (actualHatOffset * scaleY);
        
        canvas.push();
        canvas.tint(255, hatAlpha);
        canvas.image(chefHatImg, hatX, hatY, hatWidth, hatHeight);
        canvas.pop();
    } else {
        // Fallback: 기본 도형으로 그리기
        canvas.fill(255, 255, 255, hatAlpha * 0.8);
        canvas.stroke(200, hatAlpha);
        canvas.strokeWeight(2 * Math.max(scaleX, scaleY));
        
        const hatWidth = 100 * (hatSize / 100) * scaleX;
        const hatHeight = 80 * (hatSize / 100) * scaleY;
        const hatX = nose.x - hatWidth / 2;
        const hatY = nose.y - hatHeight + (actualHatOffset * scaleY);
        
        // 요리사 모자 모양
        canvas.ellipse(nose.x, hatY + 20 * scaleY, hatWidth, 40 * scaleY);
        canvas.rect(hatX + 20 * scaleX, hatY, hatWidth - 40 * scaleX, 50 * scaleY);
        
        canvas.fill(0, hatAlpha);
        canvas.textAlign(CENTER, CENTER);
        canvas.textSize(16 * Math.max(scaleX, scaleY));
        canvas.text('👨‍🍳', nose.x, hatY + 25 * scaleY);
    }
}

function drawApronOnCanvas(canvas, leftShoulder, rightShoulder, scaleX = 1, scaleY = 1) {
    const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
    const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
    
    // 투명도 계산 (100% = 255, 10% = 25.5)
    const apronAlpha = (apronOpacity / 100) * 255;
    
    // 이미지가 로드되고 유효한 경우
    if (apronImg && apronImg.width > 0) {
        const apronWidth = Math.abs(leftShoulder.x - rightShoulder.x) * (apronSize / 100) * 1.5;
        const apronHeight = apronWidth * 1.2;
        const apronX = shoulderMidX - apronWidth / 2;
        const apronY = shoulderMidY + (apronOffset * scaleY);
        
        canvas.push();
        canvas.tint(255, apronAlpha);
        canvas.image(apronImg, apronX, apronY, apronWidth, apronHeight);
        canvas.pop();
    } else {
        // Fallback: 기본 도형으로 그리기
        canvas.fill(255, 255, 255, apronAlpha * 0.7);
        canvas.stroke(200, apronAlpha);
        canvas.strokeWeight(2 * Math.max(scaleX, scaleY));
        
        const apronWidth = Math.abs(leftShoulder.x - rightShoulder.x) * (apronSize / 100);
        const apronHeight = apronWidth * 1.3;
        const apronX = shoulderMidX - apronWidth / 2;
        const apronY = shoulderMidY + (apronOffset * scaleY);
        
        // 앞치마 모양
        canvas.rect(apronX, apronY, apronWidth, apronHeight, 10 * Math.max(scaleX, scaleY));
        
        // 끈
        const neckStrapY = shoulderMidY - 20 * scaleY;
        canvas.line(leftShoulder.x, leftShoulder.y, apronX + 20 * scaleX, neckStrapY);
        canvas.line(rightShoulder.x, rightShoulder.y, apronX + apronWidth - 20 * scaleX, neckStrapY);
        
        canvas.fill(0, apronAlpha);
        canvas.textAlign(CENTER, CENTER);
        canvas.textSize(16 * Math.max(scaleX, scaleY));
        canvas.text('🍳', shoulderMidX, apronY + apronHeight / 3);
    }
}

function drawBackgroundOnCanvas(canvas, canvasWidth = CANVAS_WIDTH, canvasHeight = CANVAS_HEIGHT) {
    canvas.background(135, 206, 235);
    
    const scaleX = canvasWidth / CANVAS_WIDTH;
    const scaleY = canvasHeight / CANVAS_HEIGHT;
    
    canvas.fill(255, 255, 255, 100);
    canvas.noStroke();
    for (let i = 0; i < 15; i++) {
        let x = (i * 50 * scaleX) % (canvasWidth + 100 * scaleX);
        let y = 50 * scaleY;
        canvas.ellipse(x, y, 30 * scaleX, 30 * scaleY);
    }
    
    canvas.fill(255, 255, 255, 150);
    for (let i = 0; i < 10; i++) {
        let x = (i * 80 * scaleX) % (canvasWidth + 100 * scaleX);
        let y = canvasHeight - 100 * scaleY;
        canvas.ellipse(x, y, 20 * scaleX, 20 * scaleY);
    }
    
    canvas.fill(255, 255, 255, 80);
    canvas.textAlign(LEFT, TOP);
    canvas.textSize(40 * Math.max(scaleX, scaleY));
    canvas.text('🍳', 20 * scaleX, 20 * scaleY);
    canvas.text('👨‍🍳', canvasWidth - 80 * scaleX, 20 * scaleY);
    canvas.text('🥄', 20 * scaleX, canvasHeight - 60 * scaleY);
    canvas.text('🍽️', canvasWidth - 80 * scaleX, canvasHeight - 60 * scaleY);
}

function downloadPhoto() {
    // 현재 프리뷰 화면(필터 포함)을 바로 캡처해서 저장
    if (!video || !isVideoReady) {
        alert('카메라가 준비되지 않았습니다.');
        return;
    }
    
    // 실제 비디오 크기 가져오기
    const videoWidth = video.elt.videoWidth || video.width;
    const videoHeight = video.elt.videoHeight || video.height;
    
    // 현재 화면을 캡처
    const tempCanvas = createGraphics(videoWidth, videoHeight);
    tempCanvas.clear();
    
    if (showBackground) {
        drawBackgroundOnCanvas(tempCanvas, videoWidth, videoHeight);
    }
    
    // 비디오를 실제 크기로 그리기 (미러링)
    tempCanvas.push();
    tempCanvas.scale(-1, 1);
    tempCanvas.image(video, -videoWidth, 0, videoWidth, videoHeight);
    tempCanvas.pop();
    
    // 오버레이 추가 (좌표 스케일링)
    if (poses.length > 0) {
        const pose = poses[0];
        const scaleX = videoWidth / CANVAS_WIDTH;
        const scaleY = videoHeight / CANVAS_HEIGHT;
        
        const nose = pose.keypoints.find(kp => kp.name === 'nose');
        const leftShoulder = pose.keypoints.find(kp => kp.name === 'left_shoulder');
        const rightShoulder = pose.keypoints.find(kp => kp.name === 'right_shoulder');
        
        if (showHat && nose && nose.confidence > 0.3) {
            const scaledNose = { 
                x: videoWidth - (nose.x * scaleX), 
                y: nose.y * scaleY 
            };
            drawChefHatOnCanvas(tempCanvas, scaledNose, scaleX, scaleY);
        }
        
        if (showApron && leftShoulder && rightShoulder && 
            leftShoulder.confidence > 0.3 && rightShoulder.confidence > 0.3) {
            const scaledLeftShoulder = { 
                x: videoWidth - (leftShoulder.x * scaleX), 
                y: leftShoulder.y * scaleY 
            };
            const scaledRightShoulder = { 
                x: videoWidth - (rightShoulder.x * scaleX), 
                y: rightShoulder.y * scaleY 
            };
            drawApronOnCanvas(tempCanvas, scaledLeftShoulder, scaledRightShoulder, scaleX, scaleY);
        }
    }
    
    // 바로 다운로드
    const link = document.createElement('a');
    link.download = `chef-photo-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
    link.href = tempCanvas.canvas.toDataURL();
    link.click();
}

function setupAdjustmentControls() {
    // 모자 높이 조정
    const hatOffsetSlider = document.getElementById('hat-offset');
    const hatOffsetValue = document.getElementById('hat-offset-value');
    hatOffsetSlider.addEventListener('input', (e) => {
        hatOffset = parseInt(e.target.value);
        hatOffsetValue.textContent = hatOffset;
    });
    
    // 모자 크기 조정
    const hatSizeSlider = document.getElementById('hat-size');
    const hatSizeValue = document.getElementById('hat-size-value');
    hatSizeSlider.addEventListener('input', (e) => {
        hatSize = parseInt(e.target.value);
        hatSizeValue.textContent = hatSize;
    });
    
    // 모자 투명도 조정
    const hatOpacitySlider = document.getElementById('hat-opacity');
    const hatOpacityValue = document.getElementById('hat-opacity-value');
    hatOpacitySlider.addEventListener('input', (e) => {
        hatOpacity = parseInt(e.target.value);
        hatOpacityValue.textContent = hatOpacity;
    });
    
    // 앞치마 위치 조정
    const apronOffsetSlider = document.getElementById('apron-offset');
    const apronOffsetValue = document.getElementById('apron-offset-value');
    apronOffsetSlider.addEventListener('input', (e) => {
        apronOffset = parseInt(e.target.value);
        apronOffsetValue.textContent = apronOffset;
    });
    
    // 앞치마 크기 조정
    const apronSizeSlider = document.getElementById('apron-size');
    const apronSizeValue = document.getElementById('apron-size-value');
    apronSizeSlider.addEventListener('input', (e) => {
        apronSize = parseInt(e.target.value);
        apronSizeValue.textContent = apronSize;
    });
    
    // 앞치마 투명도 조정
    const apronOpacitySlider = document.getElementById('apron-opacity');
    const apronOpacityValue = document.getElementById('apron-opacity-value');
    apronOpacitySlider.addEventListener('input', (e) => {
        apronOpacity = parseInt(e.target.value);
        apronOpacityValue.textContent = apronOpacity;
    });
}

function captureOriginalPhoto() {
    if (!video || !isVideoReady) {
        alert('카메라가 준비되지 않았습니다.');
        return;
    }
    
    // 실제 비디오 크기 가져오기
    const videoWidth = video.elt.videoWidth || video.width;
    const videoHeight = video.elt.videoHeight || video.height;
    
    const originalCanvas = createGraphics(videoWidth, videoHeight);
    
    // 원본만 캡처 (오버레이 없음)
    originalCanvas.push();
    originalCanvas.scale(-1, 1);
    originalCanvas.image(video, -videoWidth, 0, videoWidth, videoHeight);
    originalCanvas.pop();
    
    capturedOriginal = originalCanvas;
    
    // 갤러리에 추가
    addPhotoToGallery(originalCanvas, 'original');
}

function captureBothPhotos() {
    if (!video || !isVideoReady) {
        alert('카메라가 준비되지 않았습니다.');
        return;
    }
    
    // 실제 비디오 크기 가져오기
    const videoWidth = video.elt.videoWidth || video.width;
    const videoHeight = video.elt.videoHeight || video.height;
    
    // 필터 포함된 버전 캡처
    const tempCanvas = createGraphics(videoWidth, videoHeight);
    tempCanvas.clear();
    
    if (showBackground) {
        drawBackgroundOnCanvas(tempCanvas, videoWidth, videoHeight);
    }
    
    // 비디오를 실제 크기로 그리기 (미러링)
    tempCanvas.push();
    tempCanvas.scale(-1, 1);
    tempCanvas.image(video, -videoWidth, 0, videoWidth, videoHeight);
    tempCanvas.pop();
    
    // 오버레이 추가 (좌표 스케일링)
    if (poses.length > 0) {
        const pose = poses[0];
        const scaleX = videoWidth / CANVAS_WIDTH;
        const scaleY = videoHeight / CANVAS_HEIGHT;
        
        const nose = pose.keypoints.find(kp => kp.name === 'nose');
        const leftShoulder = pose.keypoints.find(kp => kp.name === 'left_shoulder');
        const rightShoulder = pose.keypoints.find(kp => kp.name === 'right_shoulder');
        
        if (showHat && nose && nose.confidence > 0.3) {
            const scaledNose = { 
                x: videoWidth - (nose.x * scaleX), 
                y: nose.y * scaleY 
            };
            drawChefHatOnCanvas(tempCanvas, scaledNose, scaleX, scaleY);
        }
        
        if (showApron && leftShoulder && rightShoulder && 
            leftShoulder.confidence > 0.3 && rightShoulder.confidence > 0.3) {
            const scaledLeftShoulder = { 
                x: videoWidth - (leftShoulder.x * scaleX), 
                y: leftShoulder.y * scaleY 
            };
            const scaledRightShoulder = { 
                x: videoWidth - (rightShoulder.x * scaleX), 
                y: rightShoulder.y * scaleY 
            };
            drawApronOnCanvas(tempCanvas, scaledLeftShoulder, scaledRightShoulder, scaleX, scaleY);
        }
    }
    
    capturedWithFilters = tempCanvas;
    addPhotoToGallery(tempCanvas, 'filtered');
    
    // 원본 버전도 캡처
    const originalCanvas = createGraphics(videoWidth, videoHeight);
    originalCanvas.push();
    originalCanvas.scale(-1, 1);
    originalCanvas.image(video, -videoWidth, 0, videoWidth, videoHeight);
    originalCanvas.pop();
    
    capturedOriginal = originalCanvas;
    addPhotoToGallery(originalCanvas, 'original');
}

function downloadOriginalPhoto() {
    // 현재 프리뷰 화면(원본)을 바로 캡처해서 저장
    if (!video || !isVideoReady) {
        alert('카메라가 준비되지 않았습니다.');
        return;
    }
    
    // 실제 비디오 크기 가져오기
    const videoWidth = video.elt.videoWidth || video.width;
    const videoHeight = video.elt.videoHeight || video.height;
    
    // 원본만 캡처 (오버레이 없음)
    const originalCanvas = createGraphics(videoWidth, videoHeight);
    originalCanvas.push();
    originalCanvas.scale(-1, 1);
    originalCanvas.image(video, -videoWidth, 0, videoWidth, videoHeight);
    originalCanvas.pop();
    
    // 바로 다운로드
    const link = document.createElement('a');
    link.download = `original-photo-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
    link.href = originalCanvas.canvas.toDataURL();
    link.click();
}

function addPhotoToGallery(imageCanvas, type = 'filtered') {
    const timestamp = new Date().toLocaleString('ko-KR');
    const photoId = Date.now() + '_' + type;
    
    const photoData = {
        id: photoId,
        type: type,
        timestamp: timestamp,
        canvas: imageCanvas,
        dataUrl: imageCanvas.canvas.toDataURL()
    };
    
    photoGallery.push(photoData);
    updatePhotoGalleryDisplay();
    
    // 갤러리로 스크롤
    document.getElementById('preview-section').scrollIntoView({ 
        behavior: 'smooth' 
    });
}

function updatePhotoGalleryDisplay() {
    const galleryContainer = document.getElementById('photo-gallery');
    const downloadAllBtn = document.getElementById('download-all');
    
    if (photoGallery.length === 0) {
        galleryContainer.innerHTML = '<p class="no-photos">아직 촬영된 사진이 없습니다. 위에서 사진을 찍어보세요!</p>';
        document.getElementById('preview-section').style.display = 'none';
        downloadAllBtn.style.display = 'none';
        return;
    }
    
    document.getElementById('preview-section').style.display = 'block';
    downloadAllBtn.style.display = 'inline-block';
    
    galleryContainer.innerHTML = photoGallery.map(photo => `
        <div class="photo-item" data-photo-id="${photo.id}">
            <img src="${photo.dataUrl}" alt="촬영된 사진">
            <div class="photo-info">
                <h4>${photo.type === 'filtered' ? '🎭 필터 포함' : '📷 원본'}</h4>
                <p>${photo.timestamp}</p>
            </div>
            <div class="photo-actions">
                <button class="btn btn-success" onclick="downloadPhotoFromGallery('${photo.id}')">
                    💾 다운로드
                </button>
                <button class="btn btn-secondary" onclick="removePhotoFromGallery('${photo.id}')">
                    🗑️ 삭제
                </button>
            </div>
        </div>
    `).join('');
}

function downloadPhotoFromGallery(photoId) {
    const photo = photoGallery.find(p => p.id === photoId);
    if (photo) {
        const link = document.createElement('a');
        const filename = `${photo.type === 'filtered' ? 'chef-photo' : 'original-photo'}-${photo.timestamp.replace(/[/:, ]/g, '-')}.png`;
        link.download = filename;
        link.href = photo.dataUrl;
        link.click();
    }
}

function removePhotoFromGallery(photoId) {
    const index = photoGallery.findIndex(p => p.id === photoId);
    if (index !== -1) {
        photoGallery.splice(index, 1);
        updatePhotoGalleryDisplay();
    }
}

async function downloadAllPhotos() {
    if (photoGallery.length === 0) {
        alert('다운로드할 사진이 없습니다.');
        return;
    }
    
    // JSZip이 로드되었는지 확인
    if (typeof JSZip === 'undefined') {
        alert('압축 라이브러리를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
        return;
    }
    
    try {
        const zip = new JSZip();
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        
        // 각 사진을 ZIP에 추가
        for (let i = 0; i < photoGallery.length; i++) {
            const photo = photoGallery[i];
            
            // Base64 데이터에서 실제 이미지 데이터만 추출
            const base64Data = photo.dataUrl.split(',')[1];
            
            // 파일명 생성 (순서번호 + 타입 + 타임스탬프)
            const filename = `${String(i + 1).padStart(3, '0')}_${photo.type === 'filtered' ? '필터포함' : '원본'}_${photo.timestamp.replace(/[/:, ]/g, '-')}.png`;
            
            // ZIP에 파일 추가
            zip.file(filename, base64Data, { base64: true });
        }
        
        // 다운로드 버튼 상태 변경
        const downloadBtn = document.getElementById('download-all');
        const originalText = downloadBtn.innerHTML;
        downloadBtn.innerHTML = '📦 압축 중...';
        downloadBtn.disabled = true;
        
        // ZIP 파일 생성
        const content = await zip.generateAsync({ type: 'blob' });
        
        // 다운로드 링크 생성 및 클릭
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `chef-photos-${timestamp}.zip`;
        link.click();
        
        // URL 객체 정리
        URL.revokeObjectURL(link.href);
        
        // 버튼 상태 복구
        downloadBtn.innerHTML = originalText;
        downloadBtn.disabled = false;
        
        console.log(`${photoGallery.length}개의 사진이 ZIP 파일로 다운로드되었습니다.`);
        
    } catch (error) {
        console.error('ZIP 다운로드 중 오류:', error);
        alert('사진 압축 중 오류가 발생했습니다. 다시 시도해주세요.');
        
        // 버튼 상태 복구
        const downloadBtn = document.getElementById('download-all');
        downloadBtn.innerHTML = '📦 모든 사진 다운로드 (ZIP)';
        downloadBtn.disabled = false;
    }
}


window.addEventListener('beforeunload', function() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }
});