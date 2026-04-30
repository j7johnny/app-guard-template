python .\make_build_info.py --app-id my_tool --version 1.0.0 --batch-id friend-group-a --endpoint https://replace-with-your-worker.workers.dev
python -m nuitka --onefile --output-filename=my-tool.exe .\cli_app.py
