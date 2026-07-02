import torch
import timm

sd = torch.load('models/emotion_model.pth', map_location='cpu')

models = [
    'efficientnet_b0', 'efficientnet_b1', 'efficientnet_b2', 'efficientnet_b3', 
    'mobilenetv3_large_100', 'mobilenetv3_small_050', 'mobilenetv2_100',
    'resnet18', 'resnet50'
]

for m in models:
    try:
        model = timm.create_model(m, num_classes=7)
        model.load_state_dict(sd)
        print(f"Success! Model is {m}")
        exit(0)
    except Exception as e:
        pass

print("None of the standard models matched.")
